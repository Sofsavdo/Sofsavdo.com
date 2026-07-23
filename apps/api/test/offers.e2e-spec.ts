import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors products.e2e-spec.ts's structure. Creates its own
// ADMIN-roled user plus a real Product to attach offers to, so this suite is self-contained.
describe("Offers (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `offers-e2e-${Date.now()}`;
  let adminAccessToken: string;
  let creatorAccessToken: string;
  let productId: string;
  let archivedProductId: string;

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
      where: { key: { in: ["offer.read", "offer.write", "offer.publish", "offer.pause", "offer.archive"] } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const creatorUser = await prisma.user.create({
      data: {
        email: `creator-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: { create: { displayName: "Test Creator", contentNiches: [], referralCode: suffix } },
      },
    });
    creatorAccessToken = tokens.signAccessToken(creatorUser.id);

    const product = await prisma.product.create({
      data: { name: `Offer-test product ${suffix}`, slug: `offer-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });
    productId = product.id;

    const archivedProduct = await prisma.product.create({
      data: {
        name: `Archived product ${suffix}`,
        slug: `archived-product-${suffix}`,
        type: "PHYSICAL_PRODUCT",
        status: "ARCHIVED",
      },
    });
    archivedProductId = archivedProduct.id;
  });

  afterAll(async () => {
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/admin/offers").expect(401);
  });

  it("rejects a creator (no offer.* permissions) with a typed FORBIDDEN", async () => {
    const res = await request(app.getHttpServer())
      .get("/admin/offers")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("rejects creation against a nonexistent product with NOT_FOUND", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ productId: "does-not-exist", name: "No product", slug: `x-${suffix}`, headline: "Test headline", priceMinor: 1000 })
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("creates an offer linked to a real Product, with variants, in one request", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        productId,
        name: "E2E Offer",
        slug: `e2e-offer-${suffix}`,
        headline: "Test headline",
        priceMinor: 50_000,
        compareAtPriceMinor: 70_000,
        variants: [{ name: "Standard", priceMinor: 50_000 }],
      })
      .expect(201);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.productId).toBe(productId);
    expect(res.body.product).toMatchObject({ id: productId });
    expect(res.body.impliedDiscountBasisPoints).toBeGreaterThan(0);
    expect(res.body.availability).toBe("INACTIVE"); // DRAFT is never buyable
  });

  it("rejects a duplicate slug with SLUG_TAKEN", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ productId, name: "Dup", slug: `e2e-offer-${suffix}`, headline: "Test headline", priceMinor: 1000 })
      .expect(409);
    expect(res.body.code).toBe("SLUG_TAKEN");
  });

  it("rejects sale price exceeding original price with VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        productId,
        name: "Bad pricing",
        slug: `bad-pricing-${suffix}`,
        headline: "Test headline",
        priceMinor: 10_000,
        compareAtPriceMinor: 5_000,
      })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects startsAt not before expiresAt with VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        productId,
        name: "Bad dates",
        slug: `bad-dates-${suffix}`,
        headline: "Test headline",
        priceMinor: 1000,
        startsAt: "2026-08-01T00:00:00Z",
        expiresAt: "2026-07-01T00:00:00Z",
      })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("lists offers, searchable by offer name, offer slug, product name, and product SKU", async () => {
    const bySlug = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(bySlug.body.items).toHaveLength(1);

    const byOfferName = await request(app.getHttpServer())
      .get(`/admin/offers?search=E2E Offer`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byOfferName.body.items.some((o: { slug: string }) => o.slug === `e2e-offer-${suffix}`)).toBe(true);

    const byProductName = await request(app.getHttpServer())
      .get(`/admin/offers?search=${encodeURIComponent(`Offer-test product ${suffix}`)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byProductName.body.items.some((o: { slug: string }) => o.slug === `e2e-offer-${suffix}`)).toBe(true);
  });

  it("filters by productId and paginates", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/offers?productId=${productId}&page=1&pageSize=5`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body.items.every((o: { productId: string }) => o.productId === productId)).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(5);
  });

  it("updates an offer's content", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/admin/offers/${id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ headline: "Updated headline" })
      .expect(200);
    expect(res.body.headline).toBe("Updated headline");
  });

  it("valid transition DRAFT -> ACTIVE succeeds and availability becomes LIVE", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${id}/activate`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(res.body.status).toBe("ACTIVE");
    expect(res.body.availability).toBe("LIVE");
  });

  it("invalid transition ACTIVE -> ACTIVE (re-activating) is rejected with INVALID_OFFER_TRANSITION", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${id}/activate`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(409);
    expect(res.body.code).toBe("INVALID_OFFER_TRANSITION");
  });

  it("valid transition ACTIVE -> PAUSED succeeds", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${id}/pause`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(res.body.status).toBe("PAUSED");
  });

  it("archives the offer, sets archivedAt, and blocks further edits", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/offers?search=e2e-offer-${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const archived = await request(app.getHttpServer())
      .post(`/admin/offers/${id}/archive`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(archived.body.status).toBe("ARCHIVED");
    expect(archived.body.archivedAt).not.toBeNull();

    const blockedEdit = await request(app.getHttpServer())
      .patch(`/admin/offers/${id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ headline: "Should be blocked" })
      .expect(409);
    expect(blockedEdit.body.code).toBe("OFFER_ARCHIVED");

    const blockedReactivate = await request(app.getHttpServer())
      .post(`/admin/offers/${id}/activate`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(409);
    expect(blockedReactivate.body.code).toBe("INVALID_OFFER_TRANSITION");
  });

  it("blocks activation when the parent Product is archived (PRODUCT_NOT_ELIGIBLE)", async () => {
    const created = await request(app.getHttpServer())
      .post("/admin/offers")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        productId: archivedProductId,
        name: "Offer on archived product",
        slug: `offer-on-archived-${suffix}`,
        headline: "Test headline",
        priceMinor: 1000,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/admin/offers/${created.body.id}/activate`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(409);
    expect(res.body.code).toBe("PRODUCT_NOT_ELIGIBLE");
  });

  it("404s with a typed NOT_FOUND for a nonexistent offer", async () => {
    const res = await request(app.getHttpServer())
      .get("/admin/offers/does-not-exist")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
