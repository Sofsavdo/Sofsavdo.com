import { createHash } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — the full Phase 8 Checkout/Payment/Order lifecycle: Landing -> Visit
// tracking -> Checkout -> Click Prepare/Complete callback -> Order PAID -> Admin status updates ->
// Refund, plus failed payment, Pay Later, stock reservation/overselling, promo-code discount,
// referral attribution, RBAC, validation, and audit trail. Mirrors delivery.e2e-spec.ts and
// content.e2e-spec.ts's fixture/cleanup conventions.
describe("Checkout/Payment/Order (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `checkout-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let noPermsStaffToken: string;

  const SECRET = "dev-click-secret-change-me"; // configuration.ts's dev fallback — no CLICK_SECRET_KEY set in .env.test

  function clickSign(fields: { click_trans_id: string; service_id: string; merchant_trans_id: string; merchant_prepare_id?: string; amount: string; action: string; sign_time: string }): string {
    const parts =
      fields.action === "1"
        ? [fields.click_trans_id, fields.service_id, SECRET, fields.merchant_trans_id, fields.merchant_prepare_id ?? "", fields.amount, fields.action, fields.sign_time]
        : [fields.click_trans_id, fields.service_id, SECRET, fields.merchant_trans_id, fields.amount, fields.action, fields.sign_time];
    return createHash("md5").update(parts.join("")).digest("hex");
  }

  async function makeOffer(slugSuffix: string, over: { stockQuantity?: number | null; paymentOptions?: string[] } = {}) {
    const product = await prisma.product.create({
      data: { name: `Checkout-test product ${slugSuffix}`, slug: `checkout-test-product-${slugSuffix}-${suffix}`, type: "PHYSICAL_PRODUCT", stockQuantity: over.stockQuantity },
    });
    const offer = await prisma.offer.create({
      data: {
        productId: product.id,
        name: `Checkout-test offer ${slugSuffix}`,
        slug: `checkout-test-offer-${slugSuffix}-${suffix}`,
        headline: "Test",
        priceMinor: 100_000_00,
        status: "ACTIVE",
        paymentOptions: over.paymentOptions ?? ["CLICK", "PAY_LATER"],
      },
    });
    await prisma.landingPage.create({ data: { offerId: offer.id, status: "PUBLISHED", publishedAt: new Date() } });
    await prisma.offerDeliveryRegion.create({
      data: { offerId: offer.id, regionCode: "TAS", regionName: "Toshkent", feeType: "FREE", deliveryFeeMinor: 0, availability: "AVAILABLE", active: true },
    });
    return offer;
  }

  function validCustomer(phoneSuffix: string) {
    return { fullName: "Aziz Karimov", phone: `+99890${phoneSuffix}`, region: "Toshkent", district: "Chilonzor", address: "Bunyodkor ko'chasi 1" };
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

    const adminRole = await prisma.role.create({ data: { key: `checkout-admin-${suffix}`, name: "Checkout Admin" } });
    const adminPerms = await prisma.permission.findMany({ where: { key: { in: ["order.read", "order.update", "order.refund"] } } });
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `checkout-admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `checkout-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `checkout-noperm-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);
  });

  afterAll(async () => {
    await prisma.commissionLedger.deleteMany({ where: { commission: { order: { offer: { slug: { contains: suffix } } } } } });
    await prisma.commission.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.commissionRule.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.attribution.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.refund.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.orderItem.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.payment.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.promoCodeUsage.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.order.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    // Scoped by this suite's own phone-number prefix (+9989010 — see validCustomer()'s
    // "+99890${phoneSuffix}" with phoneSuffix always "100000N"), not by fullName — "Aziz Karimov"
    // is a common enough placeholder name that a manual browser-verification session hitting this
    // same dev database with the same name previously caused this cleanup to try (and fail, FK
    // RESTRICT) to delete a Customer row it doesn't own.
    await prisma.address.deleteMany({ where: { customer: { phone: { startsWith: "+9989010" } }, line1: "Bunyodkor ko'chasi 1" } });
    await prisma.customer.deleteMany({ where: { phone: { startsWith: "+9989010" } } });
    await prisma.referralVisit.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.referralLink.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.promoCode.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.landingPage.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "Order" } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("full lifecycle: visit -> checkout -> Click prepare/complete -> PAID -> admin status updates -> refund", () => {
    it(
      "runs the complete flow",
      async () => {
        const offer = await makeOffer("lifecycle", { stockQuantity: 3 });

        const visitRes = await request(app.getHttpServer()).post(`/offers/${offer.slug}/visit`).send({}).expect(201);
        expect(visitRes.body.visitorId).toBeTruthy();

        const checkoutRes = await request(app.getHttpServer())
          .post(`/offers/${offer.slug}/checkout`)
          .send({
            paymentMethod: "CLICK",
            regionCode: "TAS",
            idempotencyKey: `lifecycle-${suffix}`,
            customer: validCustomer("1000001"),
          })
          .expect(201);
        expect(checkoutRes.body.status).toBe("PAYMENT_PENDING");
        expect(checkoutRes.body.paymentRedirectUrl).toContain("https://my.click.uz/services/pay");
        expect(checkoutRes.body.totalMinor).toBe(100_000_00);
        const publicToken = checkoutRes.body.publicToken;

        const order = await prisma.order.findUnique({ where: { publicToken } });
        expect(order).not.toBeNull();
        const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
        expect(payment).not.toBeNull();
        expect(payment!.provider).toBe("CLICK");

        // Idempotency: retrying the exact same checkout submission must not create a second Order.
        const before = await prisma.order.count({ where: { offerId: offer.id } });
        await request(app.getHttpServer())
          .post(`/offers/${offer.slug}/checkout`)
          .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `lifecycle-${suffix}`, customer: validCustomer("1000001") })
          .expect(201);
        const after = await prisma.order.count({ where: { offerId: offer.id } });
        expect(after).toBe(before);

        // Click Prepare callback
        const prepareFields = { click_trans_id: "1001", service_id: "", merchant_trans_id: payment!.id, amount: "100000.00", action: "0", sign_time: "2026-07-22 10:00:00" };
        const prepareRes = await request(app.getHttpServer())
          .post("/payments/click/prepare")
          .send({ ...prepareFields, error: "0", error_note: "Success", sign_string: clickSign(prepareFields) })
          .expect(200);
        expect(prepareRes.body.error).toBe(0);
        expect(prepareRes.body.merchant_prepare_id).toBe(payment!.id);

        // Click Complete callback
        const completeFields = {
          click_trans_id: "1001",
          service_id: "",
          merchant_trans_id: payment!.id,
          merchant_prepare_id: payment!.id,
          amount: "100000.00",
          action: "1",
          sign_time: "2026-07-22 10:00:05",
        };
        const completeRes = await request(app.getHttpServer())
          .post("/payments/click/complete")
          .send({ ...completeFields, error: "0", error_note: "Success", sign_string: clickSign(completeFields) })
          .expect(200);
        expect(completeRes.body.error).toBe(0);
        expect(completeRes.body.merchant_confirm_id).toBe(payment!.id);

        const paidOrder = await prisma.order.findUnique({ where: { id: order!.id } });
        expect(paidOrder!.status).toBe("PAID");
        const paidPayment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
        expect(paidPayment!.status).toBe("PAID");
        expect(paidPayment!.providerReference).toBe("1001");

        // Stock reserved (decremented) on PAID.
        const productAfterPaid = await prisma.product.findUnique({ where: { id: offer.productId } });
        expect(productAfterPaid!.stockQuantity).toBe(2);

        // Replaying the same Complete callback must not double-decrement stock or re-fire side effects.
        await request(app.getHttpServer())
          .post("/payments/click/complete")
          .send({ ...completeFields, error: "0", error_note: "Success", sign_string: clickSign(completeFields) })
          .expect(200);
        const productAfterReplay = await prisma.product.findUnique({ where: { id: offer.productId } });
        expect(productAfterReplay!.stockQuantity).toBe(2);

        // Admin: full status progression + notes + history visible.
        const detail = await request(app.getHttpServer()).get(`/admin/orders/${order!.id}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
        expect(detail.body.status).toBe("PAID");
        expect(detail.body.payment.status).toBe("PAID");

        await request(app.getHttpServer())
          .patch(`/admin/orders/${order!.id}/status`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ status: "PROCESSING" })
          .expect(200);
        await request(app.getHttpServer())
          .patch(`/admin/orders/${order!.id}/status`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ status: "SHIPPED" })
          .expect(200);
        const delivered = await request(app.getHttpServer())
          .patch(`/admin/orders/${order!.id}/status`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ status: "DELIVERED" })
          .expect(200);
        expect(delivered.body.status).toBe("DELIVERED");
        expect(delivered.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(["CREATED", "PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

        // Illegal transition rejected.
        await request(app.getHttpServer())
          .patch(`/admin/orders/${order!.id}/status`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ status: "PROCESSING" })
          .expect(409);

        // Full refund restores stock and moves to REFUNDED.
        const refundRes = await request(app.getHttpServer())
          .post(`/admin/orders/${order!.id}/refunds`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .send({ amountMinor: 100_000_00, reason: "Customer requested a refund" })
          .expect(201);
        expect(refundRes.body.status).toBe("REFUNDED");
        const productAfterRefund = await prisma.product.findUnique({ where: { id: offer.productId } });
        expect(productAfterRefund!.stockQuantity).toBe(3);

        // Audit trail recorded the key actions.
        const auditActions = await prisma.auditLog.findMany({ where: { entityId: order!.id }, select: { action: true } });
        const actions = auditActions.map((a) => a.action);
        expect(actions).toEqual(expect.arrayContaining(["CHECKOUT_CREATED", "PAYMENT_STARTED", "PAYMENT_SUCCESS", "STATUS_UPDATED", "REFUND_REQUESTED"]));
      },
      120_000,
    );
  });

  describe("failed payment", () => {
    it("cancels the order when Click reports a payment failure", async () => {
      const offer = await makeOffer("failed");
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `failed-${suffix}`, customer: validCustomer("1000002") })
        .expect(201);
      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });

      const fields = { click_trans_id: "2002", service_id: "", merchant_trans_id: payment!.id, merchant_prepare_id: payment!.id, amount: "100000.00", action: "1", sign_time: "2026-07-22 11:00:00" };
      await request(app.getHttpServer())
        .post("/payments/click/complete")
        .send({ ...fields, error: "-9", error_note: "Transaction cancelled by user", sign_string: clickSign(fields) })
        .expect(200);

      const failedOrder = await prisma.order.findUnique({ where: { id: order!.id } });
      expect(failedOrder!.status).toBe("CANCELLED");
      const failedPayment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
      expect(failedPayment!.status).toBe("FAILED");
    });
  });

  describe("refund before delivery + direct-REFUNDED guard", () => {
    // Regression: found via real browser verification — createRefund's eligibility list
    // (PAID/PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED) originally had no matching REFUNDED edge in
    // OrdersService.TRANSITIONS for PROCESSING/SHIPPED/IN_TRANSIT, so a full refund on an order
    // still being fulfilled 409'd with INVALID_ORDER_TRANSITION.
    it("allows a full refund while an order is still PROCESSING (before delivery)", async () => {
      const offer = await makeOffer("refundmidflow", { stockQuantity: 5 });
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "PAY_LATER", regionCode: "TAS", idempotencyKey: `refundmidflow-${suffix}`, customer: validCustomer("1000013") })
        .expect(201);
      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });

      await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PAID" })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PROCESSING" })
        .expect(200);

      const refundRes = await request(app.getHttpServer())
        .post(`/admin/orders/${order!.id}/refunds`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ amountMinor: 100_000_00, reason: "Refunded before shipping" })
        .expect(201);
      expect(refundRes.body.status).toBe("REFUNDED");

      const productAfter = await prisma.product.findUnique({ where: { id: offer.productId } });
      expect(productAfter!.stockQuantity).toBe(5); // restored after markPaid's decrement
    });

    it("rejects setting REFUNDED directly via the plain status-update endpoint", async () => {
      const offer = await makeOffer("directrefund");
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "PAY_LATER", regionCode: "TAS", idempotencyKey: `directrefund-${suffix}`, customer: validCustomer("1000014") })
        .expect(201);
      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PAID" })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "REFUNDED" })
        .expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");

      const untouched = await prisma.order.findUnique({ where: { id: order!.id } });
      expect(untouched!.status).toBe("PAID"); // rejected before any state change
    });
  });

  describe("Click signature validation", () => {
    it("rejects a callback with a tampered signature via Click's own error-reply shape (never a generic 500)", async () => {
      const offer = await makeOffer("badsig");
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `badsig-${suffix}`, customer: validCustomer("1000003") })
        .expect(201);
      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });

      const res = await request(app.getHttpServer())
        .post("/payments/click/complete")
        .send({ click_trans_id: "3003", service_id: "", merchant_trans_id: payment!.id, amount: "100000.00", action: "1", sign_time: "x", error: "0", error_note: "Success", sign_string: "tampered" })
        .expect(200);
      expect(res.body.error).toBeLessThan(0);

      const untouchedOrder = await prisma.order.findUnique({ where: { id: order!.id } });
      expect(untouchedOrder!.status).toBe("PAYMENT_PENDING");
    });
  });

  describe("Pay Later", () => {
    it("creates a MANUAL payment with no redirect, then admin marks it PAID manually", async () => {
      const offer = await makeOffer("paylater");
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "PAY_LATER", regionCode: "TAS", idempotencyKey: `paylater-${suffix}`, customer: validCustomer("1000004") })
        .expect(201);
      expect(checkoutRes.body.paymentRedirectUrl).toBeNull();
      expect(checkoutRes.body.status).toBe("PAYMENT_PENDING");

      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
      expect(payment!.provider).toBe("MANUAL");

      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PAID", note: "Cash confirmed by phone" })
        .expect(200);
      expect(res.body.status).toBe("PAID");

      // Regression: found via browser verification — admin-manual approval must sync the
      // Payment row too, not just the Order (the manual path has no prior Click callback to have
      // already done it).
      const paymentAfter = await prisma.payment.findUnique({ where: { orderId: order!.id } });
      expect(paymentAfter!.status).toBe("PAID");
    });
  });

  describe("Cash on Delivery (Phase F — proves the payment provider registry, not just Click)", () => {
    it("creates a CASH_ON_DELIVERY payment with no external redirect, then admin marks it PAID on delivery", async () => {
      const offer = await makeOffer("cod", { paymentOptions: ["CLICK", "PAY_LATER", "COD"] });
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "COD", regionCode: "TAS", idempotencyKey: `cod-${suffix}`, customer: validCustomer("1000015") })
        .expect(201);
      // Same "no external redirect, straight to order-success" shape as Pay Later — the buyer
      // pays the courier in person, there is genuinely nothing to redirect to.
      expect(checkoutRes.body.paymentRedirectUrl).toBeNull();
      expect(checkoutRes.body.status).toBe("PAYMENT_PENDING");

      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const payment = await prisma.payment.findUnique({ where: { orderId: order!.id } });
      // The one assertion that actually proves the registry, not a hardcoded branch: a real
      // Payment row with a real, distinct provider value, created through the exact same
      // PaymentsService.initiatePayment code path as CLICK.
      expect(payment!.provider).toBe("CASH_ON_DELIVERY");
      expect(payment!.status).toBe("PENDING");

      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${order!.id}/status`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ status: "PAID", note: "Cash collected on delivery" })
        .expect(200);
      expect(res.body.status).toBe("PAID");

      const paymentAfter = await prisma.payment.findUnique({ where: { orderId: order!.id } });
      expect(paymentAfter!.status).toBe("PAID");
    });

    it("rejects COD when the offer doesn't list it as a supported payment option", async () => {
      const offer = await makeOffer("cod-unsupported", { paymentOptions: ["CLICK"] });
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "COD", regionCode: "TAS", idempotencyKey: `cod-unsupported-${suffix}`, customer: validCustomer("1000016") })
        .expect(400);
      expect(res.body.code).toBe("PAYMENT_METHOD_NOT_SUPPORTED");
    });
  });

  describe("stock / overselling", () => {
    it("rejects checkout with OUT_OF_STOCK when stockQuantity is 0", async () => {
      const offer = await makeOffer("outofstock", { stockQuantity: 0 });
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", idempotencyKey: `oos-${suffix}`, customer: validCustomer("1000005") })
        .expect(409);
      expect(res.body.code).toBe("OUT_OF_STOCK");
    });
  });

  describe("validation", () => {
    it("rejects a physical checkout missing region/address with CUSTOMER_INFO_INVALID", async () => {
      const offer = await makeOffer("badcustomer");
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", idempotencyKey: `badcust-${suffix}`, customer: { fullName: "Aziz", phone: "+998901000006" } })
        .expect(400);
      expect(res.body.code).toBe("CUSTOMER_INFO_INVALID");
    });

    it("rejects an unsupported payment method with PAYMENT_METHOD_NOT_SUPPORTED", async () => {
      const offer = await makeOffer("badmethod");
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "PAYME", idempotencyKey: `badmethod-${suffix}`, customer: validCustomer("1000007") })
        .expect(400);
      expect(res.body.code).toBe("PAYMENT_METHOD_NOT_SUPPORTED");
    });

    it("rejects checkout against an inactive (PAUSED) offer with OFFER_INACTIVE", async () => {
      const offer = await makeOffer("inactive");
      await prisma.offer.update({ where: { id: offer.id }, data: { status: "PAUSED" } });
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", idempotencyKey: `inactive-${suffix}`, customer: validCustomer("1000008") })
        .expect(409);
      expect(res.body.code).toBe("OFFER_INACTIVE");
    });

    it("rejects an invalid phone number at the DTO level with VALIDATION_ERROR", async () => {
      const offer = await makeOffer("badphone");
      await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", idempotencyKey: `badphone-${suffix}`, customer: { ...validCustomer("x"), phone: "not-a-phone" } })
        .expect(400);
    });
  });

  describe("promo code", () => {
    it("validates a promo code discount without creating an order, then applies it at checkout", async () => {
      const offer = await makeOffer("promo");
      const creatorUser = await prisma.user.create({
        data: { email: `checkout-promocreator-${suffix}@sofsavdo.com`, passwordHash: "x", creatorProfile: { create: { displayName: "Promo Creator", contentNiches: [], referralCode: `promo-${suffix}`.slice(0, 60) } } },
        include: { creatorProfile: true },
      });
      const campaign = await prisma.campaign.create({
        data: {
          offerId: offer.id,
          name: "Promo campaign",
          slug: `checkout-promo-campaign-${suffix}`,
          category: "beauty",
          ctaLabel: "Join",
          platforms: ["INSTAGRAM"],
          contentFormats: ["reels"],
          commissionType: "PERCENTAGE",
          commissionRateBps: 1500,
          status: "ACTIVE",
        },
      });
      const promo = await prisma.promoCode.create({
        data: { code: `PROMO${suffix}`.toUpperCase().slice(0, 30), creatorId: creatorUser.creatorProfile!.id, campaignId: campaign.id, offerId: offer.id, discountType: "PERCENTAGE", discountValue: 1000 },
      });

      const validateRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/promo-code/validate`)
        .send({ code: promo.code, baseAmountMinor: 100_000_00 })
        .expect(201);
      expect(validateRes.body.discountMinor).toBe(10_000_00);
      expect(await prisma.order.count({ where: { offerId: offer.id } })).toBe(0);

      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", promoCode: promo.code, idempotencyKey: `promo-${suffix}`, customer: validCustomer("1000009") })
        .expect(201);
      expect(checkoutRes.body.discountMinor).toBe(10_000_00);
      expect(checkoutRes.body.totalMinor).toBe(90_000_00);

      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const attribution = await prisma.attribution.findUnique({ where: { orderId: order!.id } });
      expect(attribution).toMatchObject({ source: "PROMO_CODE", creatorId: creatorUser.creatorProfile!.id, campaignId: campaign.id });
      const commission = await prisma.commission.findUnique({ where: { orderId: order!.id } });
      expect(commission!.amountMinor).toBe(applyBps(90_000_00, 1500));

      const refreshedPromo = await prisma.promoCode.findUnique({ where: { id: promo.id } });
      expect(refreshedPromo!.usageCount).toBe(1);
    });
  });

  describe("referral link attribution", () => {
    it("attributes an order to the creator behind a valid ?ref= link", async () => {
      const offer = await makeOffer("reflink");
      const creatorUser = await prisma.user.create({
        data: { email: `checkout-refcreator-${suffix}@sofsavdo.com`, passwordHash: "x", creatorProfile: { create: { displayName: "Ref Creator", contentNiches: [], referralCode: `reflink-${suffix}`.slice(0, 60) } } },
        include: { creatorProfile: true },
      });
      const campaign = await prisma.campaign.create({
        data: {
          offerId: offer.id,
          name: "Ref campaign",
          slug: `checkout-ref-campaign-${suffix}`,
          category: "beauty",
          ctaLabel: "Join",
          platforms: ["INSTAGRAM"],
          contentFormats: ["reels"],
          commissionType: "FIXED_AMOUNT",
          commissionAmountMinor: 15_000_00,
          status: "ACTIVE",
        },
      });
      const link = await prisma.referralLink.create({
        data: { code: `ref-${suffix}`.slice(0, 60), creatorId: creatorUser.creatorProfile!.id, campaignId: campaign.id, offerId: offer.id, status: "ACTIVE" },
      });

      const visitRes = await request(app.getHttpServer()).post(`/offers/${offer.slug}/visit`).send({ refCode: link.code }).expect(201);
      expect(visitRes.body.creatorDisplayName).toBe("Ref Creator");

      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", refCode: link.code, visitorId: visitRes.body.visitorId, idempotencyKey: `reflink-${suffix}`, customer: validCustomer("1000010") })
        .expect(201);

      const order = await prisma.order.findUnique({ where: { publicToken: checkoutRes.body.publicToken } });
      const attribution = await prisma.attribution.findUnique({ where: { orderId: order!.id } });
      expect(attribution).toMatchObject({ source: "REFERRAL_VISIT", creatorId: creatorUser.creatorProfile!.id, campaignId: campaign.id });
      expect(attribution!.referralVisitId).not.toBeNull();
      const commission = await prisma.commission.findUnique({ where: { orderId: order!.id } });
      expect(commission!.amountMinor).toBe(15_000_00);
    });

    it("rejects checkout with REFERRAL_CODE_INVALID for an unknown ref code", async () => {
      const offer = await makeOffer("badref");
      const res = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", refCode: "does-not-exist", idempotencyKey: `badref-${suffix}`, customer: validCustomer("1000011") })
        .expect(400);
      expect(res.body.code).toBe("REFERRAL_CODE_INVALID");
    });
  });

  describe("RBAC + order-success lookup", () => {
    it("rejects admin order list access without order.read", async () => {
      await request(app.getHttpServer()).get("/admin/orders").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("exposes only the customer-safe public shape via GET /orders/public/:publicToken", async () => {
      const offer = await makeOffer("publiclookup");
      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `publiclookup-${suffix}`, customer: validCustomer("1000012") })
        .expect(201);
      const res = await request(app.getHttpServer()).get(`/orders/public/${checkoutRes.body.publicToken}`).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ["currency", "customer", "discountMinor", "offerName", "paymentRedirectUrl", "publicToken", "shippingMinor", "status", "subtotalMinor", "totalMinor", "variantName"].sort(),
      );
    });

    it("returns ORDER_NOT_FOUND for an unknown publicToken", async () => {
      const res = await request(app.getHttpServer()).get("/orders/public/does-not-exist-token").expect(404);
      expect(res.body.code).toBe("ORDER_NOT_FOUND");
    });
  });

  describe("logged-in buyer checkout (Phase D + Phase F's @OptionalAuth() integration)", () => {
    it("links a logged-in buyer's checkout to their account automatically — no separate claim step", async () => {
      const offer = await makeOffer("buyer-linked");
      const buyer = await request(app.getHttpServer())
        .post("/auth/register-buyer")
        .send({ email: `checkout-buyer-${suffix}@sofsavdo.com`, password: "Str0ngPass!", fullName: "Checkout Buyer" })
        .expect(201);

      const checkoutRes = await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .set("Authorization", `Bearer ${buyer.body.accessToken}`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `buyerlinked-${suffix}`, customer: validCustomer("1000017") })
        .expect(201);

      const ordersRes = await request(app.getHttpServer())
        .get("/buyer/orders")
        .set("Authorization", `Bearer ${buyer.body.accessToken}`)
        .expect(200);
      expect(ordersRes.body.some((o: { publicToken: string }) => o.publicToken === checkoutRes.body.publicToken)).toBe(true);
    });

    it("guest checkout (no token at all) still works unchanged — @OptionalAuth() never requires one", async () => {
      const offer = await makeOffer("guest-still-works");
      await request(app.getHttpServer())
        .post(`/offers/${offer.slug}/checkout`)
        .send({ paymentMethod: "CLICK", regionCode: "TAS", idempotencyKey: `gueststillworks-${suffix}`, customer: validCustomer("1000018") })
        .expect(201);
    });
  });
});

function applyBps(baseMinor: number, bps: number): number {
  return Math.round((baseMinor * bps) / 10_000);
}
