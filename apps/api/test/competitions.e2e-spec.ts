import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors campaigns.e2e-spec.ts's structure.
describe("Competitions (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `competitions-e2e-${Date.now()}`;
  let adminAccessToken: string;

  let offerId: string;
  let campaignId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `comp-creator-${label}-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Comp Creator ${label} ${suffix}`,
            contentNiches: [],
            referralCode: `comp-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeSale(creatorId: string, commissionMinor: number, createdAt?: Date) {
    const customer = await prisma.customer.create({ data: { fullName: "Competition Test Buyer", phone: `+99892${Date.now()}`.slice(0, 13) } });
    const order = await prisma.order.create({
      data: {
        idempotencyKey: `comp-order-${Date.now()}-${Math.random()}`,
        type: "PHYSICAL",
        offerId,
        campaignId,
        customerId: customer.id,
        status: "DELIVERED",
        offerSnapshot: {},
        subtotalMinor: 100_000_00,
        discountMinor: 0,
        totalMinor: 100_000_00,
        currency: "UZS",
        ...(createdAt ? { createdAt } : {}),
      },
    });
    await prisma.attribution.create({ data: { orderId: order.id, creatorId, campaignId, offerId, source: "PROMO_CODE" } });
    const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
    return prisma.commission.create({
      data: {
        orderId: order.id,
        creatorId,
        commissionRuleId: rule.id,
        baseAmountMinor: 100_000_00,
        amountMinor: commissionMinor,
        status: "PENDING",
        ...(createdAt ? { createdAt } : {}),
      },
    });
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

    const role = await prisma.role.create({ data: { key: `admin-${suffix}`, name: "Admin" } });
    const perms = await prisma.permission.findMany({
      where: { key: { in: ["competition.read", "competition.write", "competition.publish", "competition.complete", "competition.archive"] } },
    });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const product = await prisma.product.create({ data: { name: `Comp-test product ${suffix}`, slug: `comp-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Comp-test offer ${suffix}`, slug: `comp-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Comp-test campaign ${suffix}`,
        slug: `comp-test-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        status: "ACTIVE",
      },
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    await prisma.commission.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.commissionRule.deleteMany({ where: { campaignId } });
    await prisma.attribution.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.order.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.customer.deleteMany({ where: { fullName: "Competition Test Buyer" } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.competition.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("admin CRUD + transitions", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/admin/competitions").expect(401);
    });

    it("full create -> publish -> complete -> archive cycle, rejecting an out-of-order transition", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };

      const created = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "E2E musobaqa", slug: `e2e-comp-${suffix}`, startAt: "2026-08-01T00:00:00.000Z", endAt: "2026-08-31T00:00:00.000Z" })
        .expect(201);
      expect(created.body.status).toBe("DRAFT");
      const id = created.body.id as string;

      // DRAFT -> COMPLETED is not allowed (must go through ACTIVE first)
      await request(app.getHttpServer()).post(`/admin/competitions/${id}/complete`).set(authHeader).expect(409);

      const published = await request(app.getHttpServer()).post(`/admin/competitions/${id}/publish`).set(authHeader).expect(201);
      expect(published.body.status).toBe("ACTIVE");

      const completed = await request(app.getHttpServer()).post(`/admin/competitions/${id}/complete`).set(authHeader).expect(201);
      expect(completed.body.status).toBe("COMPLETED");

      const archived = await request(app.getHttpServer()).post(`/admin/competitions/${id}/archive`).set(authHeader).expect(201);
      expect(archived.body.status).toBe("ARCHIVED");

      // No transition is allowed out of ARCHIVED
      await request(app.getHttpServer()).post(`/admin/competitions/${id}/publish`).set(authHeader).expect(409);
    });

    it("rejects a duplicate slug", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };
      const slug = `e2e-dup-${suffix}`;
      await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "First", slug, startAt: "2026-09-01T00:00:00.000Z", endAt: "2026-09-30T00:00:00.000Z" })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "Second", slug, startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-10-31T00:00:00.000Z" })
        .expect(409);
      expect(res.body.code).toBe("SLUG_TAKEN");
    });
  });

  describe("creator-facing", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/creator/competitions").expect(401);
    });

    it("only lists ACTIVE competitions that are currently LIVE or SCHEDULED, never DRAFT/ARCHIVED/EXPIRED", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };
      const now = Date.now();

      const live = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "Live comp", slug: `e2e-live-${suffix}`, startAt: new Date(now - 1_000_000).toISOString(), endAt: new Date(now + 1_000_000_000).toISOString() })
        .expect(201);
      await request(app.getHttpServer()).post(`/admin/competitions/${live.body.id}/publish`).set(authHeader).expect(201);

      const draft = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "Draft comp", slug: `e2e-draft-${suffix}`, startAt: new Date(now).toISOString(), endAt: new Date(now + 1_000_000_000).toISOString() })
        .expect(201);

      const creator = await makeCreator("list");
      const res = await request(app.getHttpServer()).get("/creator/competitions").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(live.body.id);
      expect(ids).not.toContain(draft.body.id);
    });

    it("scopes the leaderboard to the competition's own date window, not this-month", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };
      const oldDate = new Date("2020-01-15T00:00:00.000Z");
      const now = Date.now();

      const competition = await request(app.getHttpServer())
        .post("/admin/competitions")
        .set(authHeader)
        .send({ name: "Window comp", slug: `e2e-window-${suffix}`, startAt: new Date("2020-01-01").toISOString(), endAt: new Date("2020-01-31").toISOString() })
        .expect(201);

      const inWindow = await makeCreator("inwindow");
      const outOfWindow = await makeCreator("outofwindow");
      await makeSale(inWindow.creatorId, 10_000_00, oldDate);
      await makeSale(outOfWindow.creatorId, 999_00, new Date(now)); // real "now" — outside the 2020 window

      const res = await request(app.getHttpServer())
        .get(`/creator/competitions/${competition.body.id}/leaderboard`)
        .set("Authorization", `Bearer ${inWindow.accessToken}`)
        .expect(200);
      const ids = res.body.top.map((e: { creatorId: string }) => e.creatorId);
      expect(ids).toContain(inWindow.creatorId);
      expect(ids).not.toContain(outOfWindow.creatorId);
    });
  });
});
