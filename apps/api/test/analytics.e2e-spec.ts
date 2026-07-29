import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

const DAY_MS = 24 * 60 * 60 * 1000;

// Real Postgres, real HTTP, real RBAC — mirrors admin-operations.e2e-spec.ts's structure.
// Fixtures are pinned to a historical window ~20 years before the real "now" this suite actually
// runs at, rather than a fixed literal date — every other e2e suite in this repo creates fixtures
// with default (real-`now`) timestamps, so a distant, past window keeps this suite's aggregate
// assertions isolated from whatever else exists in the shared test database. Critically, the
// window is *derived from the real run's own Date.now()*, not a hardcoded literal: every analytics
// endpoint here caches its response in Redis for up to 300s keyed by (query + resolved range) —
// re-running this suite twice within that TTL using the exact same literal date range served the
// FIRST run's stale, already-deleted fixture data back on the second run (confirmed by the
// mismatched suffix in the cached creator's displayName). That was a real bug in this test's own
// design, not in AnalyticsCacheService — the cache behaved exactly as intended. Deriving the
// window from `Date.now()` gives every run a genuinely unique cache key, matching production
// behavior instead of fighting it.
describe("Analytics (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const runAnchor = Date.now();
  const suffix = `analytics-e2e-${runAnchor}`;

  const windowFrom = new Date(runAnchor - 20 * 365 * DAY_MS);
  const windowTo = new Date(windowFrom.getTime() + 31 * DAY_MS);
  const prevFrom = new Date(windowFrom.getTime() - 31 * DAY_MS);

  let managerToken: string; // analytics.read only
  let adminToken: string; // analytics.read + analytics.export
  let adminUserId: string;
  let noPermsToken: string;

  let productId: string;
  let campaignId: string;
  let creatorId: string;
  let paidOrderId: string;

  async function makeStaff(label: string, permissionKeys: string[]) {
    const role = await prisma.role.create({ data: { key: `analytics-${label}-${suffix}`.slice(0, 60), name: `Test role ${label}` } });
    if (permissionKeys.length > 0) {
      const perms = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
      await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    }
    const user = await prisma.user.create({ data: { email: `analytics-${label}-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return { userId: user.id, accessToken: tokens.signAccessToken(user.id) };
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

    const manager = await makeStaff("manager", ["analytics.read"]);
    managerToken = manager.accessToken;
    const admin = await makeStaff("admin", ["analytics.read", "analytics.export"]);
    adminToken = admin.accessToken;
    adminUserId = admin.userId;
    const noPerms = await makeStaff("noperm", []);
    noPermsToken = noPerms.accessToken;

    // ---- Catalog + campaign + creator ----
    const product = await prisma.product.create({ data: { name: `Analytics product ${suffix}`, slug: `analytics-product-${suffix}`, type: "PHYSICAL_PRODUCT", status: "ACTIVE" } });
    productId = product.id;
    const offer = await prisma.offer.create({
      data: { productId, name: `Analytics offer ${suffix}`, slug: `analytics-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE", paymentOptions: ["CLICK"] },
    });
    const campaign = await prisma.campaign.create({
      data: {
        offerId: offer.id,
        name: `Analytics campaign ${suffix}`,
        slug: `analytics-campaign-${suffix}`,
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
    const creatorUser = await prisma.user.create({
      data: {
        email: `analytics-creator-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: { create: { displayName: `Analytics Creator ${suffix}`, contentNiches: [], referralCode: `analytics-${suffix}`.slice(0, 60), applications: { create: { status: "APPROVED", formData: {} } } } },
      },
      include: { creatorProfile: true },
    });
    creatorId = creatorUser.creatorProfile!.id;
    await prisma.creatorCampaign.create({ data: { campaignId, creatorId, status: "ACTIVE" } });

    // ---- Customer 1: two orders in-window (order1 PAID+attributed, order2 REFUNDED) => returning ----
    const customer1 = await prisma.customer.create({ data: { fullName: `Analytics Customer1 ${suffix}`, phone: `+998901${Date.now()}`.slice(0, 16) } });
    const order1 = await prisma.order.create({
      data: {
        idempotencyKey: `analytics-order1-${suffix}`,
        type: "PHYSICAL",
        offerId: offer.id,
        campaignId,
        customerId: customer1.id,
        status: "PAID",
        offerSnapshot: {},
        subtotalMinor: 100_000,
        totalMinor: 100_000,
        createdAt: new Date(windowFrom.getTime() + 5 * DAY_MS),
      },
    });
    paidOrderId = order1.id;
    await prisma.attribution.create({ data: { orderId: order1.id, creatorId, campaignId, offerId: offer.id, source: "REFERRAL_VISIT", createdAt: order1.createdAt } });
    const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
    await prisma.commission.create({ data: { orderId: order1.id, creatorId, commissionRuleId: rule.id, baseAmountMinor: 100_000, amountMinor: 20_000, status: "PENDING", createdAt: order1.createdAt } });
    await prisma.payment.create({
      data: { orderId: order1.id, provider: "CLICK", status: "PAID", amountMinor: 100_000, idempotencyKey: `analytics-payment1-${suffix}`, createdAt: order1.createdAt },
    });

    const order2 = await prisma.order.create({
      data: {
        idempotencyKey: `analytics-order2-${suffix}`,
        type: "PHYSICAL",
        offerId: offer.id,
        campaignId,
        customerId: customer1.id,
        status: "REFUNDED",
        offerSnapshot: {},
        subtotalMinor: 50_000,
        totalMinor: 50_000,
        createdAt: new Date(windowFrom.getTime() + 10 * DAY_MS),
      },
    });
    await prisma.refund.create({
      data: { orderId: order2.id, amountMinor: 50_000, reason: "Mahsulot nosoz", status: "APPROVED", createdAt: new Date(windowFrom.getTime() + 11 * DAY_MS) },
    });

    // ---- Customer 2: one pending order in-window => new customer, no revenue ----
    const customer2 = await prisma.customer.create({ data: { fullName: `Analytics Customer2 ${suffix}`, phone: `+998902${Date.now()}`.slice(0, 16) } });
    await prisma.order.create({
      data: {
        idempotencyKey: `analytics-order3-${suffix}`,
        type: "PHYSICAL",
        offerId: offer.id,
        campaignId,
        customerId: customer2.id,
        status: "CREATED",
        offerSnapshot: {},
        subtotalMinor: 30_000,
        totalMinor: 30_000,
        createdAt: new Date(windowFrom.getTime() + 15 * DAY_MS),
      },
    });

    // ---- Referral visits (clicks) — 2 in-window, only 1 resulted in an order ----
    await prisma.referralVisit.createMany({
      data: [
        {
          creatorId,
          campaignId,
          offerId: offer.id,
          visitorId: `visitor1-${suffix}`,
          sessionId: `session1-${suffix}`,
          landingPage: "/o/analytics-offer",
          ipHash: "hash1",
          expiresAt: windowTo,
          createdAt: new Date(windowFrom.getTime() + 4 * DAY_MS),
        },
        {
          creatorId,
          campaignId,
          offerId: offer.id,
          visitorId: `visitor2-${suffix}`,
          sessionId: `session2-${suffix}`,
          landingPage: "/o/analytics-offer",
          ipHash: "hash2",
          expiresAt: windowTo,
          createdAt: new Date(windowFrom.getTime() + 4 * DAY_MS),
        },
      ],
    });

    // ---- Previous-period fixture (the 31 days immediately before windowFrom), for compare=previous ----
    const customer3 = await prisma.customer.create({ data: { fullName: `Analytics Customer3 ${suffix}`, phone: `+998903${Date.now()}`.slice(0, 16) } });
    await prisma.order.create({
      data: {
        idempotencyKey: `analytics-order4-prev-${suffix}`,
        type: "PHYSICAL",
        offerId: offer.id,
        campaignId,
        customerId: customer3.id,
        status: "PAID",
        offerSnapshot: {},
        subtotalMinor: 80_000,
        totalMinor: 80_000,
        createdAt: new Date(prevFrom.getTime() + 15 * DAY_MS),
      },
    });
  });

  afterAll(async () => {
    // Catches every export view's audit row (executive, creators, ...) — scoping only by
    // entityId: "executive" missed the "creators" export's row (entityId: "creators") the first
    // time this suite ran, leaking one AuditLog row. actorId alone is the correct, complete filter.
    await prisma.auditLog.deleteMany({ where: { actorId: adminUserId } });
    await prisma.commissionLedger.deleteMany({ where: { commission: { order: { idempotencyKey: { contains: suffix } } } } });
    await prisma.commission.deleteMany({ where: { order: { idempotencyKey: { contains: suffix } } } });
    await prisma.commissionRule.deleteMany({ where: { campaignId } });
    await prisma.refund.deleteMany({ where: { order: { idempotencyKey: { contains: suffix } } } });
    await prisma.payment.deleteMany({ where: { idempotencyKey: { contains: suffix } } });
    await prisma.attribution.deleteMany({ where: { campaignId } });
    await prisma.referralVisit.deleteMany({ where: { campaignId } });
    await prisma.order.deleteMany({ where: { idempotencyKey: { contains: suffix } } });
    await prisma.customer.deleteMany({ where: { fullName: { contains: suffix } } });
    await prisma.creatorCampaign.deleteMany({ where: { campaignId } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  function customRangeQuery(extra = "") {
    return `range=custom&from=${windowFrom.toISOString()}&to=${windowTo.toISOString()}${extra}`;
  }

  describe("RBAC guardrails", () => {
    const routes = ["/admin/analytics/executive", "/admin/analytics/creators", "/admin/analytics/campaigns", "/admin/analytics/products", "/admin/analytics/payments", "/admin/analytics/refunds", "/admin/analytics/customers"];

    it("rejects unauthenticated requests on every route", async () => {
      for (const path of routes) await request(app.getHttpServer()).get(path).expect(401);
    });

    it("a staff user with zero permissions is forbidden on every route", async () => {
      for (const path of routes) await request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${noPermsToken}`).expect(403);
    });

    it("MANAGER (analytics.read only) can read every view but is forbidden from export", async () => {
      for (const path of routes) await request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${managerToken}`).expect(200);
      await request(app.getHttpServer())
        .get(`/admin/analytics/export?view=executive&format=csv&${customRangeQuery()}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(403);
    });

    it("ADMIN (analytics.read + analytics.export) can export", async () => {
      await request(app.getHttpServer())
        .get(`/admin/analytics/export?view=executive&format=csv&${customRangeQuery()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe("Executive Dashboard", () => {
    it("computes every KPI per the approved business definitions", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/analytics/executive?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      const m = res.body.current;
      expect(m.gmvMinor).toBe(150_000); // order1 PAID + order2 REFUNDED
      expect(m.revenueMinor).toBe(100_000); // REFUNDED excluded
      expect(m.netRevenueMinor).toBe(50_000); // revenue - decided refunds
      expect(m.ordersCount).toBe(3);
      expect(m.paidOrdersCount).toBe(2);
      expect(m.pendingOrdersCount).toBe(1);
      expect(m.refundsMinor).toBe(50_000);
      expect(m.refundRate).toBeCloseTo(0.5);
      expect(m.activeCreatorsCount).toBeGreaterThanOrEqual(1);
      expect(m.activeCampaignsCount).toBeGreaterThanOrEqual(1);
      expect(m.activeProductsCount).toBeGreaterThanOrEqual(1);
      expect(m.creatorLinkConversionRate).toBeCloseTo(0.5); // 1 attributed paid order / 2 visits
      expect(m.averageOrderValueMinor).toBe(75_000); // GMV / paidOrders
      expect(m.newCustomers).toBe(2);
      expect(m.returningCustomers).toBe(1);
    });

    it("supports compare=previous with a real prior-period delta", async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/analytics/executive?${customRangeQuery("&compare=previous")}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.previous.gmvMinor).toBe(80_000);
      expect(res.body.previous.activeCampaignsCount).toBeUndefined(); // snapshot metric never compared
      expect(res.body.deltaPct.gmvMinor).toBeCloseTo(((150_000 - 80_000) / 80_000) * 100, 0);
    });

    it("rejects range=custom with from >= to", async () => {
      await request(app.getHttpServer())
        .get(`/admin/analytics/executive?range=custom&from=${windowTo.toISOString()}&to=${windowFrom.toISOString()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe("Creator / Campaign / Product Analytics", () => {
    it("creator list + detail reflect the fixture's attributed order", async () => {
      const list = await request(app.getHttpServer()).get(`/admin/analytics/creators?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(list.body.items.some((c: { creatorId: string }) => c.creatorId === creatorId)).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/admin/analytics/creators/${creatorId}?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(detail.body.ordersCount).toBe(1);
      expect(detail.body.revenueMinor).toBe(100_000);
      expect(detail.body.clicksCount).toBe(2);
      expect(detail.body.viewsCount).toBeNull();
    });

    it("campaign detail aggregates both the paid and refunded order", async () => {
      const detail = await request(app.getHttpServer()).get(`/admin/analytics/campaigns/${campaignId}?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(detail.body.ordersCount).toBe(2);
      expect(detail.body.revenueMinor).toBe(150_000);
      expect(detail.body.creatorCount).toBeGreaterThanOrEqual(1);
      expect(detail.body.topCreators.some((c: { creatorId: string }) => c.creatorId === creatorId)).toBe(true);
    });

    it("product detail reflects revenue and the refund", async () => {
      const detail = await request(app.getHttpServer()).get(`/admin/analytics/products/${productId}?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(detail.body.ordersCount).toBe(2);
      expect(detail.body.revenueMinor).toBe(150_000);
      expect(detail.body.refundsMinor).toBe(50_000);
      expect(detail.body.refundedOrdersCount).toBe(1);
    });

    it("404s for a nonexistent creator/campaign/product id", async () => {
      await request(app.getHttpServer()).get(`/admin/analytics/creators/does-not-exist?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(404);
      await request(app.getHttpServer()).get(`/admin/analytics/campaigns/does-not-exist?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(404);
      await request(app.getHttpServer()).get(`/admin/analytics/products/does-not-exist?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(404);
    });
  });

  describe("Payment / Refund / Customer Analytics", () => {
    it("payment summary reflects the one real Payment row", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/analytics/payments?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(res.body.totalCount).toBe(1);
      expect(res.body.successRate).toBe(1);
      expect(res.body.byMethod).toEqual([{ provider: "CLICK", count: 1, amountMinor: 100_000 }]);
    });

    it("refund summary reflects the one decided refund and its raw reason", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/analytics/refunds?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(res.body.requestedCount).toBe(1);
      expect(res.body.approvalRate).toBe(1);
      expect(res.body.averageRefundAmountMinor).toBe(50_000);
      expect(res.body.totalRefundedMinor).toBe(50_000);
      expect(res.body.topReasons).toEqual([{ reason: "Mahsulot nosoz", count: 1 }]);
      expect(res.body.refundRate).toBeCloseTo(0.5); // isolated window: 1 decided refund / 2 paid orders
    });

    it("rejects an unrecognized refund status filter", async () => {
      await request(app.getHttpServer()).get(`/admin/analytics/refunds?${customRangeQuery()}&status=NOT_REAL`).set("Authorization", `Bearer ${adminToken}`).expect(400);
    });

    it("customer summary reflects new vs. returning buyers", async () => {
      const res = await request(app.getHttpServer()).get(`/admin/analytics/customers?${customRangeQuery()}`).set("Authorization", `Bearer ${adminToken}`).expect(200);
      expect(res.body.activeCustomersCount).toBe(2);
      expect(res.body.newCustomersCount).toBe(2);
      expect(res.body.returningCustomersCount).toBe(1);
    });
  });

  describe("CSV export + audit", () => {
    it("returns a real CSV body and records an AuditLog entry", async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/analytics/export?view=executive&format=csv&${customRangeQuery()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text).toContain("gmvMinor");
      expect(res.text).toContain("150000");

      const auditRows = await prisma.auditLog.findMany({ where: { entityType: "AnalyticsExport", actorId: adminUserId } });
      expect(auditRows.length).toBeGreaterThan(0);
      expect((auditRows[0]!.after as { view: string }).view).toBe("executive");
    });

    it("exports the creators list as CSV rows", async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/analytics/export?view=creators&format=csv&${customRangeQuery()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.text).toContain("creatorId");
      expect(res.text).toContain(creatorId);
    });
  });

  // Keep `paidOrderId` referenced — used only to make the fixture's intent explicit above (the
  // order that anchors the Attribution/Commission/Payment chain), not asserted on directly.
  it("fixture sanity: the anchor order exists and is PAID", async () => {
    const order = await prisma.order.findUnique({ where: { id: paidOrderId } });
    expect(order?.status).toBe("PAID");
  });
});
