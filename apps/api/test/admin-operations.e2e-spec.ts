import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors onboarding.e2e-spec.ts's structure. Covers the six
// Admin Operations domains (Phase 12): staff Users, Roles & Permissions, Creator administration,
// Payments (read-only), Refunds (approve/reject), Settings, and the general Audit-log browser.
// See DECISIONS.md ADR-019.
describe("Admin Operations (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `adminops-e2e-${Date.now()}`;

  let superAdminToken: string;
  let superAdminId: string;
  let readOnlyToken: string;
  let noPermsToken: string;

  async function makeStaff(label: string, permissionKeys: string[]) {
    const role = await prisma.role.create({ data: { key: `adminops-${label}-${suffix}`.slice(0, 60), name: `Test role ${label}` } });
    if (permissionKeys.length > 0) {
      const perms = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
      await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    }
    const user = await prisma.user.create({ data: { email: `adminops-${label}-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return { userId: user.id, roleId: role.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeCreator(label: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED" = "ACTIVE") {
    const user = await prisma.user.create({
      data: {
        email: `adminops-creator-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        status,
        creatorProfile: {
          create: {
            displayName: `AdminOps Creator ${label}`,
            city: "Toshkent",
            contentNiches: [],
            referralCode: `adminops-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id };
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    const superAdmin = await makeStaff(
      "super",
      ["user.read", "user.manage", "role.read", "role.manage", "creator.read", "creator.review", "creator.suspend", "creator.block", "payment.read", "refund.read", "refund.manage", "settings.read", "settings.write", "audit.read"],
    );
    superAdminToken = superAdmin.accessToken;
    superAdminId = superAdmin.userId;

    const readOnly = await makeStaff("readonly", ["user.read", "role.read", "creator.read", "creator.review", "payment.read", "refund.read", "settings.read", "audit.read"]);
    readOnlyToken = readOnly.accessToken;

    const noPerms = await makeStaff("noperm", []);
    noPermsToken = noPerms.accessToken;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: [superAdminId] } }, { entityId: { contains: suffix } }] } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    // makeStaff's roles are created directly via Prisma with the hyphenated suffix verbatim in
    // their key, but Role.key can only contain [a-z0-9_] through the real API (see CreateRoleDto),
    // so the "custom role" test converts hyphens to underscores before using it as a key —
    // matching only one form here would silently leak the other every run (caught during Phase 12
    // browser verification: a real leftover row from exactly this mismatch, cleaned up manually
    // once and fixed here so it can't recur).
    const roleKeyPatterns = [suffix, suffix.replace(/-/g, "_")];
    await prisma.rolePermission.deleteMany({ where: { role: { OR: roleKeyPatterns.map((p) => ({ key: { contains: p } })) } } });
    await prisma.role.deleteMany({ where: { OR: roleKeyPatterns.map((p) => ({ key: { contains: p } })) } });
    await moduleRef.close();
  });

  describe("RBAC guardrails across every new domain", () => {
    const routes: [string, string][] = [
      ["get", "/admin/users"],
      ["get", "/admin/roles"],
      ["get", "/admin/permissions"],
      ["get", "/admin/creators"],
      ["get", "/admin/payments"],
      ["get", "/admin/refunds"],
      ["get", "/admin/settings"],
      ["get", "/admin/audit-log"],
    ];

    it("rejects unauthenticated requests on every new route", async () => {
      for (const [, path] of routes) {
        await request(app.getHttpServer()).get(path).expect(401);
      }
    });

    it("a staff user with zero permissions is forbidden on every new route", async () => {
      for (const [, path] of routes) {
        const res = await request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${noPermsToken}`).expect(403);
        expect(res.body.code).toBe("FORBIDDEN");
      }
    });

    it("a read-only staff user can list but cannot mutate (settings.write missing)", async () => {
      await request(app.getHttpServer()).get("/admin/settings").set("Authorization", `Bearer ${readOnlyToken}`).expect(200);
      await request(app.getHttpServer())
        .patch("/admin/settings")
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ values: { "general.platformName": "Hacked" } })
        .expect(403);
    });
  });

  describe("Users domain", () => {
    let createdUserId: string;

    it("creates a staff user with a role, hashed password, and audit entry", async () => {
      const roles = await request(app.getHttpServer()).get("/admin/roles").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const managerRole = roles.body.find((r: { key: string }) => r.key === "manager");

      const res = await request(app.getHttpServer())
        .post("/admin/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ email: `adminops-newstaff-${suffix}@rosti.uz`, password: "password123", displayName: "New Staff", roleIds: [managerRole.id] })
        .expect(201);
      expect(res.body.displayName).toBe("New Staff");
      expect(res.body.roles.some((r: { key: string }) => r.key === "manager")).toBe(true);
      createdUserId = res.body.id;
    });

    it("lists and searches staff, and supports pagination", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/users?search=${encodeURIComponent("New Staff")}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(res.body.items.some((u: { id: string }) => u.id === createdUserId)).toBe(true);
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("totalPages");
    });

    it("edits, deactivates, then reactivates the staff user", async () => {
      const edited = await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ displayName: "Renamed Staff" })
        .expect(200);
      expect(edited.body.displayName).toBe("Renamed Staff");

      const deactivated = await request(app.getHttpServer()).post(`/admin/users/${createdUserId}/deactivate`).set("Authorization", `Bearer ${superAdminToken}`).expect(201);
      expect(deactivated.body.status).toBe("SUSPENDED");

      const reactivated = await request(app.getHttpServer()).post(`/admin/users/${createdUserId}/activate`).set("Authorization", `Bearer ${superAdminToken}`).expect(201);
      expect(reactivated.body.status).toBe("ACTIVE");
    });

    it("resets the staff user's password without ever exposing it in the response", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/users/${createdUserId}/reset-password`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ newPassword: "brandnewpassword123" })
        .expect(201);
      expect(JSON.stringify(res.body)).not.toContain("brandnewpassword123");
    });

    it("assigns and removes a role, refusing to remove the last one", async () => {
      const roles = await request(app.getHttpServer()).get("/admin/roles").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const adminRole = roles.body.find((r: { key: string }) => r.key === "admin");
      const managerRole = roles.body.find((r: { key: string }) => r.key === "manager");

      const assigned = await request(app.getHttpServer())
        .post(`/admin/users/${createdUserId}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ roleId: adminRole.id })
        .expect(201);
      expect(assigned.body.roles.length).toBe(2);

      await request(app.getHttpServer()).delete(`/admin/users/${createdUserId}/roles/${managerRole.id}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const lastRole = await request(app.getHttpServer()).delete(`/admin/users/${createdUserId}/roles/${adminRole.id}`).set("Authorization", `Bearer ${superAdminToken}`).expect(400);
      expect(lastRole.body.code).toBe("VALIDATION_ERROR");
    });

    it("blocks a staff user from deactivating their own account", async () => {
      const res = await request(app.getHttpServer()).post(`/admin/users/${superAdminId}/deactivate`).set("Authorization", `Bearer ${superAdminToken}`).expect(409);
      expect(res.body.code).toBe("CANNOT_MODIFY_SELF");
    });

    it("every mutation above produced a real audit entry", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/audit-log?entityType=User&search=${createdUserId}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const actions = new Set(res.body.items.map((e: { action: string }) => e.action));
      for (const expected of ["STAFF_CREATED", "STAFF_UPDATED", "STAFF_DEACTIVATED", "STAFF_ACTIVATED", "STAFF_PASSWORD_RESET", "STAFF_ROLE_ASSIGNED", "STAFF_ROLE_REMOVED"]) {
        expect(actions.has(expected)).toBe(true);
      }
    });
  });

  describe("Roles & Permissions domain", () => {
    let customRoleId: string;

    it("creates a custom role, then assigns and removes a permission", async () => {
      const created = await request(app.getHttpServer())
        .post("/admin/roles")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ key: `custom_role_${suffix}`.replace(/-/g, "_").slice(0, 60).toLowerCase(), name: "Custom Test Role" })
        .expect(201);
      customRoleId = created.body.id;
      expect(created.body.permissions).toEqual([]);

      const assigned = await request(app.getHttpServer())
        .post(`/admin/roles/${customRoleId}/permissions`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ permissionKey: "product.read" })
        .expect(201);
      expect(assigned.body.permissions).toContain("product.read");

      await request(app.getHttpServer()).delete(`/admin/roles/${customRoleId}/permissions/product.read`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
    });

    it("updates the role's name/description", async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/admin/roles/${customRoleId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ name: "Renamed Custom Role" })
        .expect(200);
      expect(updated.body.name).toBe("Renamed Custom Role");
    });

    it("exposes the full permission matrix", async () => {
      const res = await request(app.getHttpServer()).get("/admin/permissions").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(res.body).toContain("role.manage");
      expect(res.body).toContain("refund.manage");
    });

    it("protects the seeded super_admin role's own management keys from removal", async () => {
      const roles = await request(app.getHttpServer()).get("/admin/roles").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const seededSuperAdmin = roles.body.find((r: { key: string }) => r.key === "super_admin");
      const res = await request(app.getHttpServer())
        .delete(`/admin/roles/${seededSuperAdmin.id}/permissions/role.manage`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(409);
      expect(res.body.code).toBe("CANNOT_MODIFY_SYSTEM_ROLE");
    });

    it("rejects a duplicate role key", async () => {
      const res = await request(app.getHttpServer())
        .post("/admin/roles")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ key: "manager", name: "Duplicate" })
        .expect(409);
      expect(res.body.code).toBe("CONFLICT");
    });
  });

  describe("Creator administration domain", () => {
    it("lists creators, filters by account status, and returns a detail with campaign/earnings/payout/referral data", async () => {
      const creator = await makeCreator("detail");
      const list = await request(app.getHttpServer()).get("/admin/creators?accountStatus=ACTIVE").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(list.body.items.some((c: { id: string }) => c.id === creator.creatorId)).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/admin/creators/${creator.creatorId}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(detail.body.verified).toBe(true);

      await request(app.getHttpServer()).get(`/admin/creators/${creator.creatorId}/campaign-history`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      await request(app.getHttpServer()).get(`/admin/creators/${creator.creatorId}/earnings-summary`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      await request(app.getHttpServer()).get(`/admin/creators/${creator.creatorId}/payout-summary`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const referral = await request(app.getHttpServer()).get(`/admin/creators/${creator.creatorId}/referral-summary`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(referral.body).toHaveProperty("referralCode");
    });

    it("suspends then unsuspends a creator, blocking login while suspended", async () => {
      const creator = await makeCreator("suspend-flow");
      await request(app.getHttpServer())
        .post(`/admin/creators/${creator.creatorId}/suspend`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Suspicious activity under review" })
        .expect(201);

      const loginBlocked = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: `adminops-creator-suspend-flow-${suffix}@rosti.uz`, password: "x" })
        .expect(403);
      expect(loginBlocked.body.code).toBe("FORBIDDEN");

      await request(app.getHttpServer()).post(`/admin/creators/${creator.creatorId}/unsuspend`).set("Authorization", `Bearer ${superAdminToken}`).expect(201);
    });

    it("blocks a creator — only reachable with creator.block — then unblocks", async () => {
      const creator = await makeCreator("block-flow");
      const forbidden = await request(app.getHttpServer())
        .post(`/admin/creators/${creator.creatorId}/block`)
        .set("Authorization", `Bearer ${readOnlyToken}`)
        .send({ reason: "Severe violation" })
        .expect(403);
      expect(forbidden.body.code).toBe("FORBIDDEN");

      const blocked = await request(app.getHttpServer())
        .post(`/admin/creators/${creator.creatorId}/block`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Severe violation" })
        .expect(201);
      expect(blocked.body.accountStatus).toBe("BLOCKED");

      await request(app.getHttpServer()).post(`/admin/creators/${creator.creatorId}/unblock`).set("Authorization", `Bearer ${superAdminToken}`).expect(201);
    });

    it("rejects an out-of-order transition (unsuspend on an ACTIVE creator)", async () => {
      const creator = await makeCreator("wrong-state");
      const res = await request(app.getHttpServer()).post(`/admin/creators/${creator.creatorId}/unsuspend`).set("Authorization", `Bearer ${superAdminToken}`).expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Payments domain (read-only)", () => {
    let paymentId: string;

    beforeAll(async () => {
      const product = await prisma.product.create({ data: { name: `AdminOps payment product ${suffix}`, slug: `adminops-payment-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
      const offer = await prisma.offer.create({ data: { productId: product.id, name: `AdminOps offer ${suffix}`, slug: `adminops-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" } });
      const customer = await prisma.customer.create({ data: { fullName: `AdminOps Customer ${suffix}`, phone: `+998901${Date.now()}`.slice(0, 16) } });
      const order = await prisma.order.create({
        data: {
          idempotencyKey: `adminops-order-${suffix}`,
          type: "PHYSICAL",
          offerId: offer.id,
          customerId: customer.id,
          status: "PAID",
          offerSnapshot: {},
          subtotalMinor: 100_000,
          totalMinor: 100_000,
        },
      });
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "CLICK",
          status: "PAID",
          amountMinor: 100_000,
          providerReference: `click-${suffix}`,
          webhookPayloads: [{ status: "success", suffix }],
          idempotencyKey: `adminops-payment-${suffix}`,
        },
      });
      paymentId = payment.id;
    });

    afterAll(async () => {
      await prisma.payment.deleteMany({ where: { idempotencyKey: { contains: suffix } } });
      await prisma.order.deleteMany({ where: { idempotencyKey: { contains: suffix } } });
      await prisma.customer.deleteMany({ where: { fullName: { contains: suffix } } });
      await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
      await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    });

    it("lists, searches, filters by status/provider, and returns detail + timeline", async () => {
      const list = await request(app.getHttpServer()).get(`/admin/payments?search=${encodeURIComponent("AdminOps Customer")}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(list.body.items.some((p: { id: string }) => p.id === paymentId)).toBe(true);

      const filtered = await request(app.getHttpServer()).get("/admin/payments?status=PAID&provider=CLICK").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(filtered.body.items.some((p: { id: string }) => p.id === paymentId)).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/admin/payments/${paymentId}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(detail.body.order.customerName).toContain("AdminOps Customer");

      const timeline = await request(app.getHttpServer()).get(`/admin/payments/${paymentId}/timeline`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(Array.isArray(timeline.body)).toBe(true);
      expect(timeline.body.length).toBeGreaterThan(0);
    });
  });

  describe("Refunds domain", () => {
    let refundId: string;

    beforeAll(async () => {
      const product = await prisma.product.create({ data: { name: `AdminOps refund product ${suffix}`, slug: `adminops-refund-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
      const offer = await prisma.offer.create({ data: { productId: product.id, name: `AdminOps refund offer ${suffix}`, slug: `adminops-refund-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" } });
      const customer = await prisma.customer.create({ data: { fullName: `AdminOps Refund Customer ${suffix}`, phone: `+998902${Date.now()}`.slice(0, 16) } });
      const order = await prisma.order.create({
        data: {
          idempotencyKey: `adminops-refund-order-${suffix}`,
          type: "PHYSICAL",
          offerId: offer.id,
          customerId: customer.id,
          status: "PAID",
          offerSnapshot: {},
          subtotalMinor: 100_000,
          totalMinor: 100_000,
        },
      });
      const refund = await prisma.refund.create({ data: { orderId: order.id, amountMinor: 50_000, reason: "Partial dissatisfaction", status: "REQUESTED" } });
      refundId = refund.id;
    });

    afterAll(async () => {
      await prisma.refund.deleteMany({ where: { reason: { contains: "dissatisfaction" } } });
      await prisma.order.deleteMany({ where: { idempotencyKey: { contains: suffix } } });
      await prisma.customer.deleteMany({ where: { fullName: { contains: suffix } } });
      await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
      await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    });

    it("lists the queue, filters by status, and shows detail", async () => {
      const list = await request(app.getHttpServer()).get("/admin/refunds?status=REQUESTED").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(list.body.items.some((r: { id: string }) => r.id === refundId)).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/admin/refunds/${refundId}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(detail.body.isPartial).toBe(true);
    });

    it("a read-only user (no refund.manage) cannot approve", async () => {
      const res = await request(app.getHttpServer()).post(`/admin/refunds/${refundId}/approve`).set("Authorization", `Bearer ${readOnlyToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("rejects the refund with a reason, then rejects a second decision on the same row", async () => {
      const badReason = await request(app.getHttpServer()).post(`/admin/refunds/${refundId}/reject`).set("Authorization", `Bearer ${superAdminToken}`).send({ reason: "no" }).expect(400);
      expect(badReason.body.code).toBe("VALIDATION_ERROR");

      const rejected = await request(app.getHttpServer())
        .post(`/admin/refunds/${refundId}/reject`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ reason: "Insufficient evidence provided" })
        .expect(201);
      expect(rejected.body.status).toBe("REJECTED");

      const again = await request(app.getHttpServer()).post(`/admin/refunds/${refundId}/approve`).set("Authorization", `Bearer ${superAdminToken}`).expect(409);
      expect(again.body.code).toBe("INVALID_REFUND_TRANSITION");
    });
  });

  describe("Settings domain", () => {
    it("reads all 7 categories with catalog defaults", async () => {
      const res = await request(app.getHttpServer()).get("/admin/settings").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const categories = new Set(res.body.map((s: { category: string }) => s.category));
      expect(categories.size).toBe(7);
    });

    it("rejects an unknown setting key and a type mismatch", async () => {
      const unknown = await request(app.getHttpServer())
        .patch("/admin/settings")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ values: { "not.a.real.key": 1 } })
        .expect(400);
      expect(unknown.body.code).toBe("INVALID_SETTING_VALUE");

      const wrongType = await request(app.getHttpServer())
        .patch("/admin/settings")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ values: { "general.platformName": 123 } })
        .expect(400);
      expect(wrongType.body.code).toBe("INVALID_SETTING_VALUE");
    });

    it("updates a setting, persists it, and audits the change", async () => {
      await request(app.getHttpServer())
        .patch("/admin/settings")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ values: { "general.platformName": `AdminOps Test ${suffix}` } })
        .expect(200);

      const reread = await request(app.getHttpServer()).get("/admin/settings").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      const platformName = reread.body.find((s: { key: string }) => s.key === "general.platformName");
      expect(platformName.value).toBe(`AdminOps Test ${suffix}`);

      const audit = await request(app.getHttpServer()).get("/admin/audit-log?action=SETTINGS_UPDATED").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(audit.body.items.length).toBeGreaterThan(0);

      // Restore the default so this suite leaves no persistent side effect on shared settings.
      await request(app.getHttpServer())
        .patch("/admin/settings")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ values: { "general.platformName": "Rosti" } })
        .expect(200);
    });
  });

  describe("Audit log browser (read-only, general)", () => {
    it("filters by entityType, actor, action, and date range, and supports a detail read", async () => {
      const byEntity = await request(app.getHttpServer()).get("/admin/audit-log?entityType=Setting").set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(byEntity.body.items.length).toBeGreaterThan(0);

      const byActor = await request(app.getHttpServer()).get(`/admin/audit-log?actorId=${superAdminId}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(byActor.body.items.length).toBeGreaterThan(0);

      const byDate = await request(app.getHttpServer())
        .get(`/admin/audit-log?dateFrom=${new Date(Date.now() - 3600_000).toISOString()}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(byDate.body.items.length).toBeGreaterThan(0);

      const detail = await request(app.getHttpServer()).get(`/admin/audit-log/${byEntity.body.items[0].id}`).set("Authorization", `Bearer ${superAdminToken}`).expect(200);
      expect(detail.body.id).toBe(byEntity.body.items[0].id);
    });
  });
});
