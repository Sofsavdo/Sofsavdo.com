import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — self-contained, mirrors offers.e2e-spec.ts's structure.
// Creates its own ADMIN-roled user plus a real Product + Offer to attach a landing to.
describe("Landings (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `landings-e2e-${Date.now()}`;
  let adminAccessToken: string;
  let creatorAccessToken: string;
  let offerId: string;
  let offerSlug: string;
  let secondOfferId: string;

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
      where: { key: { in: ["landing.read", "landing.write", "landing.publish", "landing.archive", "offer.read"] } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const creatorUser = await prisma.user.create({
      data: {
        email: `creator-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: { create: { displayName: "Test Creator", contentNiches: [], referralCode: suffix } },
      },
    });
    creatorAccessToken = tokens.signAccessToken(creatorUser.id);

    const product = await prisma.product.create({
      data: { name: `Landing-test product ${suffix}`, slug: `landing-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });

    const offer = await prisma.offer.create({
      data: {
        productId: product.id,
        name: `Landing-test offer ${suffix}`,
        slug: `landing-test-offer-${suffix}`,
        headline: "Test headline",
        priceMinor: 50_000,
        status: "ACTIVE",
      },
    });
    offerId = offer.id;
    offerSlug = offer.slug;

    const secondOffer = await prisma.offer.create({
      data: {
        productId: product.id,
        name: `Second landing-test offer ${suffix}`,
        slug: `second-landing-test-offer-${suffix}`,
        headline: "Test headline 2",
        priceMinor: 20_000,
        status: "ACTIVE",
      },
    });
    secondOfferId = secondOffer.id;
  });

  afterAll(async () => {
    await prisma.landingSection.deleteMany({ where: { landingPage: { offer: { slug: { contains: suffix } } } } });
    await prisma.landingPage.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get(`/admin/offers/${offerId}/landing`).expect(401);
  });

  it("rejects a creator (no landing.* permissions) with a typed FORBIDDEN", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("404s with a typed NOT_FOUND before a landing exists for this offer", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("the public route 404s before any landing exists", async () => {
    const res = await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("creates a DRAFT landing linked to a real Offer", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ seoTitle: "Test SEO title", seoKeywords: ["glow", "serum"] })
      .expect(201);
    expect(res.body.offerId).toBe(offerId);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.seoTitle).toBe("Test SEO title");
  });

  it("rejects creating a second landing for the same offer with LANDING_ALREADY_EXISTS", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({})
      .expect(409);
    expect(res.body.code).toBe("LANDING_ALREADY_EXISTS");
  });

  it("rejects creating a landing against a nonexistent offer with NOT_FOUND", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/offers/does-not-exist/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({})
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("adds sections (HERO, FAQ) and lists them in sortOrder", async () => {
    await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ type: "HERO", content: { title: "Glow up" } })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ type: "FAQ", content: { items: [] } })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].type).toBe("HERO");
    expect(res.body[1].type).toBe("FAQ");
  });

  it("the public route still 404s while the landing is DRAFT", async () => {
    const res = await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("preview (admin-authenticated) returns the DRAFT landing's rendered shape", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing/preview`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body.offer.slug).toBe(offerSlug);
    expect(res.body.sections).toHaveLength(2);
  });

  it("publishes the landing", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing/publish`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(res.body.status).toBe("PUBLISHED");
    expect(res.body.publishedAt).not.toBeNull();
  });

  it("the public route now returns 200 with offer + active sections, and never internal fields", async () => {
    const res = await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(200);
    expect(res.body.offer.slug).toBe(offerSlug);
    expect(res.body.offer.priceMinor).toBe(50_000);
    expect(res.body.offer.availability).toBe("LIVE");
    expect(res.body.sections).toHaveLength(2);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("internalDescription");
    expect(serialized).not.toContain("createdById");
    expect(serialized).not.toContain("costPriceMinor");
  });

  it("toggling a section inactive removes it from the public payload", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const faqId = list.body.find((s: { type: string }) => s.type === "FAQ").id;

    await request(app.getHttpServer())
      .patch(`/admin/landing-sections/${faqId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false })
      .expect(200);

    const res = await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(200);
    expect(res.body.sections).toHaveLength(1);
    expect(res.body.sections[0].type).toBe("HERO");
  });

  it("reorders sections", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const ids = list.body.map((s: { id: string }) => s.id);
    const reversed = [...ids].reverse();

    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing-sections/reorder`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ orderedIds: reversed })
      .expect(201);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual(reversed);
  });

  it("removes a section and closes the sortOrder gap", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const toRemove = list.body[0].id;

    await request(app.getHttpServer())
      .delete(`/admin/landing-sections/${toRemove}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get(`/admin/offers/${offerId}/landing-sections`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].sortOrder).toBe(0);
  });

  it("unpublishes back to DRAFT, and the public route 404s again", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing/unpublish`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(res.body.status).toBe("DRAFT");

    await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(404);
  });

  it("archives the landing, sets archivedAt, and blocks further edits", async () => {
    const archived = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing/archive`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(archived.body.status).toBe("ARCHIVED");
    expect(archived.body.archivedAt).not.toBeNull();

    const blockedEdit = await request(app.getHttpServer())
      .patch(`/admin/offers/${offerId}/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ seoTitle: "Should be blocked" })
      .expect(409);
    expect(blockedEdit.body.code).toBe("LANDING_ARCHIVED");

    const blockedRepublish = await request(app.getHttpServer())
      .post(`/admin/offers/${offerId}/landing/publish`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(409);
    expect(blockedRepublish.body.code).toBe("INVALID_LANDING_TRANSITION");
  });

  it("the public route stays 404 once archived, even if it was published before", async () => {
    await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(404);
  });

  it("a second offer's landing is fully independent (own create/publish lifecycle)", async () => {
    await request(app.getHttpServer())
      .post(`/admin/offers/${secondOfferId}/landing`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/offers/${secondOfferId}/landing/publish`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/offers/${offerSlug}/public`).expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
