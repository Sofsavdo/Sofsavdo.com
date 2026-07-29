import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — GET /creator/sales (Phase A production-hardening pass). Fixture/
// cleanup conventions mirror wallet-payouts.e2e-spec.ts exactly (Commission/Order/Attribution
// created directly via Prisma, not through a real checkout call — checkout mechanics are already
// covered by checkout.e2e-spec.ts).
describe("Creator Sales (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `creator-sales-e2e-${Date.now()}`;

  let offerId: string;
  let campaignId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `sales-creator-${label}-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Sales Creator ${label}`,
            contentNiches: [],
            referralCode: `sls-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeSale(creatorId: string, opts: { fullName: string; phone: string; commissionMinor: number }) {
    const customer = await prisma.customer.create({ data: { fullName: opts.fullName, phone: opts.phone } });
    const order = await prisma.order.create({
      data: {
        idempotencyKey: `sales-order-${Date.now()}-${Math.random()}`,
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
    const commission = await prisma.commission.create({
      data: { orderId: order.id, creatorId, commissionRuleId: rule.id, baseAmountMinor: 90_000_00, amountMinor: opts.commissionMinor, status: "PENDING" },
    });
    return { order, commission, customer };
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

    const product = await prisma.product.create({ data: { name: `Sales-test product ${suffix}`, slug: `sales-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Sales-test offer ${suffix}`, slug: `sales-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Sales-test campaign ${suffix}`,
        slug: `sales-test-campaign-${suffix}`,
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
    await prisma.customer.deleteMany({ where: { phone: { contains: suffix.slice(-8) } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await moduleRef.close();
  });

  it("returns the creator's own sales with masked customer contact info, never the raw name/phone", async () => {
    const creator = await makeCreator("mine");
    await makeSale(creator.creatorId, { fullName: "Aziz Karimov", phone: "+998901234512", commissionMinor: 18_000_00 });

    const res = await request(app.getHttpServer()).get("/creator/sales").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      customerMasked: "A. Karimov, +998 90 *** ** 12",
      amountMinor: 100_000_00,
      discountMinor: 10_000_00,
      commissionMinor: 18_000_00,
      orderStatus: "DELIVERED",
      attributionSource: "PROMO_CODE",
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("Aziz Karimov");
    expect(raw).not.toContain("+998901234512");
  });

  it("never returns another creator's sales (ownership-scoped, not just filtered client-side)", async () => {
    const creatorA = await makeCreator("ownera");
    const creatorB = await makeCreator("ownerb");
    await makeSale(creatorA.creatorId, { fullName: "Creator A Buyer", phone: "+998901111111", commissionMinor: 5_000_00 });

    const resB = await request(app.getHttpServer()).get("/creator/sales").set("Authorization", `Bearer ${creatorB.accessToken}`).expect(200);
    expect(resB.body).toEqual([]);

    const resA = await request(app.getHttpServer()).get("/creator/sales").set("Authorization", `Bearer ${creatorA.accessToken}`).expect(200);
    expect(resA.body).toHaveLength(1);
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/creator/sales").expect(401);
  });
});
