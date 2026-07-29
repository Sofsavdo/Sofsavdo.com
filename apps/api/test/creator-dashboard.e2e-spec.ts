import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — GET /creator/dashboard-stats (Phase J). Fixture/cleanup conventions
// mirror creator-sales.e2e-spec.ts exactly.
describe("Creator Dashboard Stats (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `creator-dashboard-e2e-${Date.now()}`;

  let offerId: string;
  let campaignId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `dash-creator-${label}-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Dash Creator ${label}`,
            contentNiches: [],
            referralCode: `dsh-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeSale(creatorId: string, opts: { commissionMinor: number; status?: "PENDING" | "APPROVED" | "PAID" | "REJECTED" }) {
    const customer = await prisma.customer.create({ data: { fullName: "Dashboard Test Buyer", phone: `+99890${Date.now()}`.slice(0, 13) } });
    const order = await prisma.order.create({
      data: {
        idempotencyKey: `dash-order-${Date.now()}-${Math.random()}`,
        type: "PHYSICAL",
        offerId,
        campaignId,
        customerId: customer.id,
        status: "DELIVERED",
        offerSnapshot: {},
        subtotalMinor: 100_000_00,
        discountMinor: 10_000_00,
        totalMinor: 90_000_00,
        currency: "UZS",
      },
    });
    await prisma.attribution.create({ data: { orderId: order.id, creatorId, campaignId, offerId, source: "PROMO_CODE" } });
    const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
    return prisma.commission.create({
      data: { orderId: order.id, creatorId, commissionRuleId: rule.id, baseAmountMinor: 90_000_00, amountMinor: opts.commissionMinor, status: opts.status ?? "PENDING" },
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

    const product = await prisma.product.create({ data: { name: `Dash-test product ${suffix}`, slug: `dash-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Dash-test offer ${suffix}`, slug: `dash-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Dash-test campaign ${suffix}`,
        slug: `dash-test-campaign-${suffix}`,
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
    await prisma.customer.deleteMany({ where: { fullName: "Dashboard Test Buyer" } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/creator/dashboard-stats").expect(401);
  });

  it("computes real lifetime/today/monthToDate stats from this creator's own Commission rows, excluding REJECTED from earnings", async () => {
    const creator = await makeCreator("real");
    await makeSale(creator.creatorId, { commissionMinor: 18_000_00, status: "PENDING" });
    await makeSale(creator.creatorId, { commissionMinor: 9_000_00, status: "REJECTED" });

    const res = await request(app.getHttpServer()).get("/creator/dashboard-stats").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);

    expect(res.body.lifetime.ordersCount).toBe(2);
    expect(res.body.lifetime.commissionMinor).toBe(18_000_00); // the REJECTED one is excluded
    expect(res.body.today.ordersCount).toBe(2);
    expect(res.body.wallet).toHaveProperty("availableMinor");
    expect(Array.isArray(res.body.dailyRevenue30d)).toBe(true);
    expect(res.body.dailyRevenue30d).toHaveLength(30);
  });

  it("never mixes in another creator's commissions (ownership-scoped)", async () => {
    const creatorA = await makeCreator("scopeda");
    const creatorB = await makeCreator("scopedb");
    await makeSale(creatorA.creatorId, { commissionMinor: 5_000_00 });

    const resB = await request(app.getHttpServer()).get("/creator/dashboard-stats").set("Authorization", `Bearer ${creatorB.accessToken}`).expect(200);
    expect(resB.body.lifetime.ordersCount).toBe(0);
    expect(resB.body.lifetime.commissionMinor).toBe(0);

    const resA = await request(app.getHttpServer()).get("/creator/dashboard-stats").set("Authorization", `Bearer ${creatorA.accessToken}`).expect(200);
    expect(resA.body.lifetime.ordersCount).toBe(1);
    expect(resA.body.lifetime.commissionMinor).toBe(5_000_00);
  });
});
