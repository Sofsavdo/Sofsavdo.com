import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";

// Real Postgres, real HTTP — Buyer Accounts (Phase D). Fixture/cleanup conventions mirror
// creator-sales.e2e-spec.ts. Checkout mechanics themselves (pricing, attribution, payment
// provider resolution) are already covered by checkout.e2e-spec.ts — this suite only covers what
// Phase D actually added: buyer register/login, saved products, buyer addresses, buyer order
// reads, and the Customer/Buyer reconciliation merge rule (see DECISIONS.md ADR-024).
describe("Buyer Accounts (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `buyer-e2e-${Date.now()}`;
  let offerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const product = await prisma.product.create({ data: { name: `Buyer-test product ${suffix}`, slug: `buyer-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Buyer-test offer ${suffix}`, slug: `buyer-test-offer-${suffix}`, headline: "Test", priceMinor: 50_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
  });

  afterAll(async () => {
    await prisma.savedProduct.deleteMany({ where: { offerId } });
    await prisma.buyerAddress.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.order.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.customer.deleteMany({ where: { phone: { contains: suffix.slice(-8) } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("register-buyer / login", () => {
    it("registers a buyer with no CreatorProfile created", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer1-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Malika Yusupova" })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.creatorId).toBeNull();
    });

    it("rejects a duplicate email with EMAIL_TAKEN", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer1-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Malika Yusupova" })
        .expect(409);
      expect(res.body.code).toBe("EMAIL_TAKEN");
    });

    it("logs a registered buyer in via the shared /auth/login endpoint", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: `buyer1-${suffix}@sofsavdo.com`, password: "Str0ngPass!" })
        .expect(201);
    });
  });

  describe("Customer/Buyer reconciliation (DECISIONS.md ADR-024)", () => {
    it("links a pre-existing guest Customer row to a new buyer account registering with the same phone", async () => {
      const guestPhone = `+99890${suffix.replace(/\D/g, "").slice(-7)}`;
      const guestCustomer = await prisma.customer.create({ data: { fullName: "Guest Buyer", phone: guestPhone } });
      await prisma.order.create({
        data: {
          idempotencyKey: `buyer-reconcile-${Date.now()}`,
          type: "PHYSICAL",
          offerId,
          customerId: guestCustomer.id,
          status: "DELIVERED",
          offerSnapshot: {},
          subtotalMinor: 50_000_00,
          discountMinor: 0,
          totalMinor: 50_000_00,
          currency: "UZS",
        },
      });

      const registerRes = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ phone: guestPhone, password: "Str0ngPass!", fullName: "Malika Yusupova" })
        .expect(201);

      const relinkedCustomer = await prisma.customer.findUnique({ where: { id: guestCustomer.id } });
      expect(relinkedCustomer?.userId).toBe(registerRes.body.user.id);

      // The buyer's own order history now shows the order that was placed before their account
      // existed — this is the concrete, user-visible proof the merge rule actually works, not
      // just a database-row assertion.
      const ordersRes = await request(app.getHttpServer())
        .get("/buyer/orders")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`)
        .expect(200);
      expect(ordersRes.body.some((o: { offerName: string }) => o.offerName === `Buyer-test offer ${suffix}`)).toBe(true);
    });
  });

  describe("buyer orders — ownership scoping", () => {
    it("returns an empty list for a buyer with no orders at all", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-noorders-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "No Orders" })
        .expect(201);
      const ordersRes = await request(app.getHttpServer()).get("/buyer/orders").set("Authorization", `Bearer ${res.body.accessToken}`).expect(200);
      expect(ordersRes.body).toEqual([]);
    });

    it("404s (ORDER_NOT_FOUND) when a buyer requests another buyer's order by id", async () => {
      const buyerA = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-a-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Buyer A" })
        .expect(201);
      const buyerB = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-b-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Buyer B" })
        .expect(201);

      const customerA = await prisma.customer.create({ data: { fullName: "Buyer A", phone: `+99891${suffix.replace(/\D/g, "").slice(-7)}`, userId: buyerA.body.user.id } });
      const orderA = await prisma.order.create({
        data: {
          idempotencyKey: `buyer-a-order-${Date.now()}`,
          type: "PHYSICAL",
          offerId,
          customerId: customerA.id,
          status: "CREATED",
          offerSnapshot: {},
          subtotalMinor: 50_000_00,
          discountMinor: 0,
          totalMinor: 50_000_00,
          currency: "UZS",
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/buyer/orders/${orderA.id}`)
        .set("Authorization", `Bearer ${buyerB.body.accessToken}`)
        .expect(404);
      expect(res.body.code).toBe("ORDER_NOT_FOUND");
    });

    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/buyer/orders").expect(401);
    });
  });

  describe("saved products", () => {
    it("saves, lists, and unsaves a product idempotently", async () => {
      const buyer = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-saves-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Saver" })
        .expect(201);
      const token = buyer.body.accessToken;

      await request(app.getHttpServer()).post(`/buyer/saved-products/${offerId}`).set("Authorization", `Bearer ${token}`).expect(201);
      // Saving twice is a no-op, not an error (see SavedProductsService.save's own comment).
      await request(app.getHttpServer()).post(`/buyer/saved-products/${offerId}`).set("Authorization", `Bearer ${token}`).expect(201);

      const listRes = await request(app.getHttpServer()).get("/buyer/saved-products").set("Authorization", `Bearer ${token}`).expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].offer.slug).toBe(`buyer-test-offer-${suffix}`);

      await request(app.getHttpServer()).delete(`/buyer/saved-products/${offerId}`).set("Authorization", `Bearer ${token}`).expect(200);
      const afterUnsave = await request(app.getHttpServer()).get("/buyer/saved-products").set("Authorization", `Bearer ${token}`).expect(200);
      expect(afterUnsave.body).toEqual([]);
    });
  });

  describe("buyer addresses", () => {
    it("creates the first address as default, adds a second as non-default, then switches the default", async () => {
      const buyer = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-addr-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Address Owner" })
        .expect(201);
      const token = buyer.body.accessToken;

      const first = await request(app.getHttpServer())
        .post("/buyer/addresses")
        .set("Authorization", `Bearer ${token}`)
        .send({ region: "Toshkent", city: "Toshkent", line1: "Chilonzor 1" })
        .expect(201);
      expect(first.body.isDefault).toBe(true);

      const second = await request(app.getHttpServer())
        .post("/buyer/addresses")
        .set("Authorization", `Bearer ${token}`)
        .send({ region: "Samarqand", city: "Samarqand", line1: "Registon 1" })
        .expect(201);
      expect(second.body.isDefault).toBe(false);

      await request(app.getHttpServer()).patch(`/buyer/addresses/${second.body.id}/set-default`).set("Authorization", `Bearer ${token}`).expect(200);

      const list = await request(app.getHttpServer()).get("/buyer/addresses").set("Authorization", `Bearer ${token}`).expect(200);
      const firstAfter = list.body.find((a: { id: string }) => a.id === first.body.id);
      const secondAfter = list.body.find((a: { id: string }) => a.id === second.body.id);
      expect(firstAfter.isDefault).toBe(false);
      expect(secondAfter.isDefault).toBe(true);
    });

    it("rejects updating another buyer's address with NOT_FOUND", async () => {
      const buyerA = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-addr-a-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "A" })
        .expect(201);
      const buyerB = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `buyer-addr-b-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "B" })
        .expect(201);

      const addr = await request(app.getHttpServer())
        .post("/buyer/addresses")
        .set("Authorization", `Bearer ${buyerA.body.accessToken}`)
        .send({ region: "Toshkent", city: "Toshkent", line1: "Chilonzor 1" })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/buyer/addresses/${addr.body.id}`)
        .set("Authorization", `Bearer ${buyerB.body.accessToken}`)
        .send({ line1: "Hacked" })
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });
});
