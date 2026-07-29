import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — GET /creator/leaderboard (Phase K). Fixture/cleanup conventions
// mirror creator-dashboard.e2e-spec.ts exactly.
describe("Creator Leaderboard (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `creator-leaderboard-e2e-${Date.now()}`;

  let offerId: string;
  let campaignId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `lb-creator-${label}-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `LB Creator ${label} ${suffix}`,
            contentNiches: [],
            referralCode: `lb-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeSale(creatorId: string, commissionMinor: number) {
    const customer = await prisma.customer.create({ data: { fullName: "Leaderboard Test Buyer", phone: `+99891${Date.now()}`.slice(0, 13) } });
    const order = await prisma.order.create({
      data: {
        idempotencyKey: `lb-order-${Date.now()}-${Math.random()}`,
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
      },
    });
    await prisma.attribution.create({ data: { orderId: order.id, creatorId, campaignId, offerId, source: "PROMO_CODE" } });
    const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
    return prisma.commission.create({
      data: { orderId: order.id, creatorId, commissionRuleId: rule.id, baseAmountMinor: 100_000_00, amountMinor: commissionMinor, status: "PENDING" },
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

    const product = await prisma.product.create({ data: { name: `LB-test product ${suffix}`, slug: `lb-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `LB-test offer ${suffix}`, slug: `lb-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `LB-test campaign ${suffix}`,
        slug: `lb-test-campaign-${suffix}`,
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
    await prisma.customer.deleteMany({ where: { fullName: "Leaderboard Test Buyer" } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/creator/leaderboard").expect(401);
  });

  it("ranks creators by this-month commission earned, descending, and includes each requester's own rank", async () => {
    const top = await makeCreator("top");
    const bottom = await makeCreator("bottom");
    await makeSale(top.creatorId, 50_000_00);
    await makeSale(bottom.creatorId, 5_000_00);

    const resTop = await request(app.getHttpServer()).get("/creator/leaderboard").set("Authorization", `Bearer ${top.accessToken}`).expect(200);
    const topEntry = resTop.body.top.find((e: { creatorId: string }) => e.creatorId === top.creatorId);
    const bottomEntry = resTop.body.top.find((e: { creatorId: string }) => e.creatorId === bottom.creatorId);
    expect(topEntry.rank).toBeLessThan(bottomEntry.rank);
    expect(topEntry.commissionMinor).toBe(50_000_00);
    expect(resTop.body.me).toMatchObject({ creatorId: top.creatorId, commissionMinor: 50_000_00 });
  });

  it("returns me: null for a creator with no Commission this month", async () => {
    const noSales = await makeCreator("nosales");
    const res = await request(app.getHttpServer()).get("/creator/leaderboard").set("Authorization", `Bearer ${noSales.accessToken}`).expect(200);
    expect(res.body.me).toBeNull();
  });
});
