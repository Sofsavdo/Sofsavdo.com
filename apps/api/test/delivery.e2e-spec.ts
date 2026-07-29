import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — regional delivery pricing (admin CRUD) + the public quote endpoint
// (POST /offers/:slug/quote) and the public landing's embedded deliveryRegions. Mirrors
// offers.e2e-spec.ts's structure/cleanup convention.
describe("Delivery (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `delivery-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let physicalOfferId: string;
  let physicalOfferSlug: string;
  let digitalOfferId: string;
  let digitalOfferSlug: string;

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

    const adminRole = await prisma.role.create({ data: { key: `delivery-admin-${suffix}`, name: "Delivery Admin" } });
    const writePerm = await prisma.permission.findFirst({ where: { key: "offer.write" } });
    await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: writePerm!.id } });
    const adminUser = await prisma.user.create({ data: { email: `delivery-admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const physicalProduct = await prisma.product.create({
      data: { name: `Delivery-test physical ${suffix}`, slug: `delivery-test-physical-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });
    physicalOfferSlug = `delivery-test-physical-offer-${suffix}`;
    const physicalOffer = await prisma.offer.create({
      data: { productId: physicalProduct.id, name: "Physical offer", slug: physicalOfferSlug, headline: "Test", priceMinor: 299_000_00, status: "ACTIVE" },
    });
    physicalOfferId = physicalOffer.id;
    await prisma.landingPage.create({ data: { offerId: physicalOfferId, status: "PUBLISHED", publishedAt: new Date() } });

    const digitalProduct = await prisma.product.create({
      data: { name: `Delivery-test digital ${suffix}`, slug: `delivery-test-digital-${suffix}`, type: "DIGITAL_PRODUCT" },
    });
    digitalOfferSlug = `delivery-test-digital-offer-${suffix}`;
    const digitalOffer = await prisma.offer.create({
      data: { productId: digitalProduct.id, name: "Digital offer", slug: digitalOfferSlug, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    digitalOfferId = digitalOffer.id;
    await prisma.landingPage.create({ data: { offerId: digitalOfferId, status: "PUBLISHED", publishedAt: new Date() } });
  });

  afterAll(async () => {
    await prisma.offerDeliveryRegion.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.landingPage.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("admin delivery-region CRUD", () => {
    it("rejects a delivery region for a non-physical (DIGITAL) offer with PRODUCT_NOT_PHYSICAL", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/offers/${digitalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "TAS", regionName: "Toshkent", feeType: "FREE" })
        .expect(409);
      expect(res.body.code).toBe("PRODUCT_NOT_PHYSICAL");
    });

    it("creates a FREE region for a physical offer", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "TAS", regionName: "Toshkent", feeType: "FREE" })
        .expect(201);
      expect(res.body.deliveryFeeMinor).toBe(0);
    });

    it("creates a FIXED region with a positive fee", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "AND", regionName: "Andijon", feeType: "FIXED", deliveryFeeMinor: 25_000_00, estimatedMinDays: 3, estimatedMaxDays: 5 })
        .expect(201);
      expect(res.body.deliveryFeeMinor).toBe(25_000_00);
    });

    it("rejects a duplicate offerId+regionCode with CONFLICT", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "TAS", regionName: "Toshkent (duplicate)", feeType: "FREE" })
        .expect(409);
      expect(res.body.code).toBe("CONFLICT");
    });

    it("rejects estimatedMinDays greater than estimatedMaxDays with VALIDATION_ERROR", async () => {
      await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "FER", regionName: "Farg'ona", feeType: "FREE", estimatedMinDays: 5, estimatedMaxDays: 2 })
        .expect(400);
    });

    it("creates an initially-UNAVAILABLE region, which must not be publicly selectable", async () => {
      await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "REMOTE", regionName: "Uzoq hudud", feeType: "FIXED", deliveryFeeMinor: 80_000_00, availability: "UNAVAILABLE" })
        .expect(201);
    });

    it("creates an inactive region, which must not appear on the public landing", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "INACTIVE1", regionName: "Nofaol region", feeType: "FREE", active: false })
        .expect(201);
      expect(res.body.active).toBe(false);
    });

    it("lists regions in deterministic sortOrder", async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      const sortOrders = res.body.map((r: { sortOrder: number }) => r.sortOrder);
      expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
    });

    it("updates a region (toggle active)", async () => {
      const list = await request(app.getHttpServer()).get(`/admin/offers/${physicalOfferId}/delivery-regions`).set("Authorization", `Bearer ${adminAccessToken}`);
      const tas = list.body.find((r: { regionCode: string }) => r.regionCode === "TAS");
      const res = await request(app.getHttpServer())
        .patch(`/admin/delivery-regions/${tas.id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ active: false })
        .expect(200);
      expect(res.body.active).toBe(false);
      // restore for subsequent quote tests
      await request(app.getHttpServer()).patch(`/admin/delivery-regions/${tas.id}`).set("Authorization", `Bearer ${adminAccessToken}`).send({ active: true }).expect(200);
    });

    it("deletes a region", async () => {
      const created = await request(app.getHttpServer())
        .post(`/admin/offers/${physicalOfferId}/delivery-regions`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ regionCode: "TEMP", regionName: "Temp", feeType: "FREE" })
        .expect(201);
      await request(app.getHttpServer()).delete(`/admin/delivery-regions/${created.body.id}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(204);
      const gone = await prisma.offerDeliveryRegion.findUnique({ where: { id: created.body.id } });
      expect(gone).toBeNull();
    });
  });

  describe("public landing + quote", () => {
    it("the public landing for the physical offer embeds only active+available regions", async () => {
      const res = await request(app.getHttpServer()).get(`/offers/${physicalOfferSlug}/public`).expect(200);
      const codes = res.body.deliveryRegions.map((r: { regionCode: string }) => r.regionCode);
      expect(codes).toContain("TAS");
      expect(codes).toContain("AND");
      expect(codes).not.toContain("REMOTE"); // UNAVAILABLE
      expect(codes).not.toContain("INACTIVE1"); // active: false
      // No internal fields (id/active/availability) on the public shape.
      for (const r of res.body.deliveryRegions) {
        expect(r).not.toHaveProperty("active");
        expect(r).not.toHaveProperty("availability");
        expect(r).not.toHaveProperty("id");
      }
    });

    it("the public landing for the digital offer has an empty deliveryRegions array", async () => {
      const res = await request(app.getHttpServer()).get(`/offers/${digitalOfferSlug}/public`).expect(200);
      expect(res.body.deliveryRegions).toEqual([]);
      expect(res.body.productType).toBe("DIGITAL_PRODUCT");
    });

    it("quotes a non-physical offer with total = price, regionRequired=false, no Order created", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${digitalOfferSlug}/quote`).send({}).expect(201);
      expect(res.body).toMatchObject({ priceMinor: 100_000_00, deliveryFeeMinor: 0, totalMinor: 100_000_00, regionRequired: false });
    });

    it("quotes a physical offer with no regionCode as REGION_REQUIRED", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({}).expect(400);
      expect(res.body.code).toBe("REGION_REQUIRED");
    });

    it("quotes a free region: total = price, delivery = 0 (spec's free-region example)", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "TAS" }).expect(201);
      expect(res.body).toMatchObject({ priceMinor: 299_000_00, deliveryFeeMinor: 0, totalMinor: 299_000_00, currency: "UZS" });
    });

    it("quotes a paid region: total = price + delivery fee (spec's paid-region example)", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "AND" }).expect(201);
      expect(res.body).toMatchObject({ priceMinor: 299_000_00, deliveryFeeMinor: 25_000_00, totalMinor: 324_000_00 });
    });

    it("rejects a quote against an UNAVAILABLE region with DELIVERY_REGION_UNAVAILABLE", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "REMOTE" }).expect(409);
      expect(res.body.code).toBe("DELIVERY_REGION_UNAVAILABLE");
    });

    it("rejects a quote against an unknown regionCode with DELIVERY_REGION_NOT_FOUND", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "NOPE" }).expect(404);
      expect(res.body.code).toBe("DELIVERY_REGION_NOT_FOUND");
    });

    it("the quote response never leaks internal cost/notes fields — only the documented public contract", async () => {
      const res = await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "TAS" }).expect(201);
      expect(Object.keys(res.body).sort()).toEqual(
        ["currency", "deliveryFeeMinor", "estimatedMaxDays", "estimatedMinDays", "priceMinor", "regionCode", "regionName", "regionRequired", "totalMinor"].sort(),
      );
    });

    it("never creates an Order as a side effect of quoting", async () => {
      const before = await prisma.order.count();
      await request(app.getHttpServer()).post(`/offers/${physicalOfferSlug}/quote`).send({ regionCode: "TAS" }).expect(201);
      const after = await prisma.order.count();
      expect(after).toBe(before);
    });
  });
});
