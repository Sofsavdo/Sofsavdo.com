import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../src/prisma/prisma.module";
import { RolesModule } from "../src/roles/roles.module";
import { RolesService } from "../src/roles/roles.service";
import { PrismaService } from "../src/prisma/prisma.service";
import configuration from "../src/config/configuration";

// Exercises the real Role/Permission/RolePermission/UserRole join against Postgres — the part
// PermissionsGuard's unit test (which mocks everything) intentionally does not cover: that the
// aggregation query itself is correct against real relational rows, including a user with two
// roles whose permission sets must union, not overwrite.
describe("RolesService (e2e)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let roles: RolesService;
  const suffix = `e2e-${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, RolesModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    roles = moduleRef.get(RolesService);
    await prisma.$connect();
  });

  // `moduleRef.close()`, not just `prisma.$disconnect()` — closing the Nest testing module runs
  // every provider's `onModuleDestroy` lifecycle hook, which is what actually calls
  // PrismaService's own `pool.end()` on the underlying pg.Pool. Calling `$disconnect()` alone
  // left that pool's socket open, which is why this suite used to trigger Jest's "did not exit
  // one second after the test run" warning.
  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await prisma.permission.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("returns no roles/permissions for a user with none assigned", async () => {
    const user = await prisma.user.create({
      data: { email: `bare-${suffix}@rosti.uz`, passwordHash: "x" },
    });
    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.roleKeys).toEqual([]);
    expect(result.permissions).toEqual([]);
  });

  it("unions permissions across multiple assigned roles instead of overwriting", async () => {
    const permA = await prisma.permission.create({ data: { key: `order.read-${suffix}`, label: "read" } });
    const permB = await prisma.permission.create({ data: { key: `payout.approve-${suffix}`, label: "approve" } });

    const roleA = await prisma.role.create({ data: { key: `role-a-${suffix}`, name: "A" } });
    const roleB = await prisma.role.create({ data: { key: `role-b-${suffix}`, name: "B" } });
    await prisma.rolePermission.create({ data: { roleId: roleA.id, permissionId: permA.id } });
    await prisma.rolePermission.create({ data: { roleId: roleB.id, permissionId: permB.id } });

    const user = await prisma.user.create({ data: { email: `dual-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleA.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roleB.id } });

    const result = await roles.getRoleKeysAndPermissionsForUser(user.id);
    expect(result.roleKeys.sort()).toEqual([`role-a-${suffix}`, `role-b-${suffix}`].sort());
    expect(result.permissions.sort()).toEqual([`order.read-${suffix}`, `payout.approve-${suffix}`].sort());
  });
});
