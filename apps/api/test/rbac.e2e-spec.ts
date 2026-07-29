import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaModule } from "../src/prisma/prisma.module";
import { RolesModule } from "../src/roles/roles.module";
import { RolesService } from "../src/roles/roles.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../src/roles/permissions.constants";
import { AuditModule } from "../src/common/audit/audit.module";
import configuration from "../src/config/configuration";

// Real-database counterpart of permissions.constants.spec.ts (which is pure/no-DB) and
// permissions.guard.spec.ts (which mocks the reflector/user). This suite seeds real
// Role/Permission/RolePermission/UserRole rows and asserts the actual grants a MANAGER/ADMIN/
// SUPER_ADMIN user ends up with, that revoking a role takes effect on the very next read (no
// caching layer to go stale), and that access tokens never carry role/permission data that could
// go stale independently of the database.
describe("RBAC (e2e)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let roles: RolesService;
  let tokens: TokenService;
  const suffix = `rbac-e2e-${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      // AuditModule: see roles.e2e-spec.ts's identical fix — RolesService has needed AuditService
      // since Phase 12's admin role management landed, and this suite (older, from Phase 6A) never
      // picked up the new constructor dependency.
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, AuditModule, RolesModule],
      providers: [TokenService, JwtService, ConfigService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    roles = moduleRef.get(RolesService);
    tokens = moduleRef.get(TokenService);
    await prisma.$connect();

    // One round trip instead of 37 sequential upserts — meaningfully faster against a proxied
    // test database, and just as idempotent (skipDuplicates) since Permission.key is globally
    // shared, not suffix-scoped like the Role rows below.
    await prisma.permission.createMany({
      data: PERMISSIONS.map((key) => ({ key, label: key })),
      skipDuplicates: true,
    });
    for (const roleKey of ["manager", "admin", "super_admin"] as const) {
      const role = await prisma.role.upsert({
        where: { key: `${roleKey}-${suffix}` },
        update: {},
        create: { key: `${roleKey}-${suffix}`, name: roleKey },
      });
      const perms = await prisma.permission.findMany({ where: { key: { in: DEFAULT_ROLE_PERMISSIONS[roleKey] } } });
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  });

  // moduleRef.close() (not just $disconnect()) so PrismaService's onModuleDestroy actually runs
  // and closes the underlying pg.Pool — see the matching comment in roles.e2e-spec.ts.
  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  // Several `it()` blocks each need their own MANAGER/ADMIN/SUPER_ADMIN user within the same
  // suite run — `Date.now()` is per-file granularity, not per-call, so reusing just `suffix` for
  // every user's email collided on the second call for a given role (confirmed: this crashed two
  // real tests with a P2002 on User.email). callCounter makes every user's email unique
  // regardless of how many times a given role is requested in one run.
  let callCounter = 0;
  async function makeStaffUser(roleKey: "manager" | "admin" | "super_admin") {
    callCounter += 1;
    const user = await prisma.user.create({ data: { email: `${roleKey}-${callCounter}-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    const role = await prisma.role.findUniqueOrThrow({ where: { key: `${roleKey}-${suffix}` } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return user;
  }

  it("MANAGER ends up with exactly the manager permission set from Postgres", async () => {
    const user = await makeStaffUser("manager");
    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.permissions.sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS.manager].sort());
  });

  it("ADMIN ends up with exactly the admin permission set from Postgres", async () => {
    const user = await makeStaffUser("admin");
    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.permissions.sort()).toEqual([...DEFAULT_ROLE_PERMISSIONS.admin].sort());
  });

  it("SUPER_ADMIN ends up with every one of the 37 permissions", async () => {
    const user = await makeStaffUser("super_admin");
    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.permissions.sort()).toEqual([...PERMISSIONS].sort());
  });

  it("a plain creator (no UserRole at all) has zero permissions — would be rejected by PermissionsGuard", async () => {
    const user = await prisma.user.create({
      data: {
        email: `creator-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: { create: { displayName: "Test Creator", contentNiches: [], referralCode: suffix } },
      },
    });
    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.roleKeys).toEqual([]);
    expect(result.permissions).toEqual([]);
  });

  it("revoking a role takes effect on the very next read — no caching layer to go stale", async () => {
    const user = await makeStaffUser("manager");
    const before = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(before.permissions.length).toBeGreaterThan(0);

    await prisma.userRole.deleteMany({ where: { userId: user.id } });

    const after = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(after.roleKeys).toEqual([]);
    expect(after.permissions).toEqual([]);
  });

  it("access tokens carry no role/permission claims — the JWT itself can never go stale", async () => {
    const user = await makeStaffUser("admin");
    const accessToken = tokens.signAccessToken(user.id);
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;

    expect(payload.sub).toBe(user.id);
    expect(payload).not.toHaveProperty("roleKeys");
    expect(payload).not.toHaveProperty("permissions");
    expect(payload).not.toHaveProperty("roles");
  });
});
