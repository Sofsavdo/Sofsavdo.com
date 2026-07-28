import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — the Phase 9 Wallet/Commission Settlement/Payout domain: Commission
// PENDING -> APPROVED -> PAYABLE -> PAID, wallet balance aggregation, payout method CRUD,
// withdrawal request -> admin REQUESTED -> APPROVED -> PROCESSING -> PAID (ledger settled),
// reject/cancel/failed paths, refund-triggered commission reversal, insufficient-balance
// rejection, RBAC, and audit trail. Mirrors checkout.e2e-spec.ts's fixture/cleanup conventions.
// Commission/Order/Payment fixtures are created directly via Prisma (not through a real checkout
// HTTP call) — the checkout mechanics that produce a Commission row are already exhaustively
// covered by checkout.e2e-spec.ts; this suite only needs "a Commission row exists in some state"
// as a starting point.
describe("Wallet/Commission Settlement/Payouts (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `wallet-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let noPermsStaffToken: string;
  let offerId: string;
  let campaignId: string;

  // RequireCreatorGuard (gates every /creator/wallet, /creator/payout-methods, /creator/payouts
  // route) requires a real APPROVED CreatorApplication row, not just a CreatorProfile — same
  // fixture requirement as content.e2e-spec.ts's makeCreator.
  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `wallet-creator-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Wallet Creator ${label}`,
            contentNiches: [],
            referralCode: `wlt-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  // Creates an Order + Payment(PAID) + Attribution + CommissionRule + Commission directly via
  // Prisma, in whatever Commission.status the caller needs as a starting point.
  async function makeCommission(creatorId: string, amountMinor: number, status: "PENDING" | "APPROVED" | "PAYABLE" | "PAID" = "PENDING") {
    const customer = await prisma.customer.create({ data: { fullName: `Test Customer ${suffix}`, phone: `+998900${Date.now()}`.slice(0, 16) } });
    const order = await prisma.order.create({
      data: {
        idempotencyKey: `wallet-order-${Date.now()}-${Math.random()}`,
        type: "PHYSICAL",
        offerId,
        campaignId,
        customerId: customer.id,
        status: "PAID",
        offerSnapshot: {},
        subtotalMinor: amountMinor * 5,
        totalMinor: amountMinor * 5,
        currency: "UZS",
      },
    });
    await prisma.attribution.create({ data: { orderId: order.id, creatorId, campaignId, offerId, source: "REFERRAL_VISIT" } });
    const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
    const now = new Date();
    const commission = await prisma.commission.create({
      data: {
        orderId: order.id,
        creatorId,
        commissionRuleId: rule.id,
        baseAmountMinor: amountMinor * 5,
        amountMinor,
        status,
        approvedAt: status === "APPROVED" || status === "PAYABLE" || status === "PAID" ? now : null,
        payableAt: status === "PAYABLE" || status === "PAID" ? now : null,
        paidAt: status === "PAID" ? now : null,
      },
    });
    if (status === "APPROVED" || status === "PAYABLE" || status === "PAID") {
      await prisma.commissionLedger.create({ data: { commissionId: commission.id, type: "ACCRUAL", amountMinor } });
    }
    return { order, commission };
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

    const adminRole = await prisma.role.create({ data: { key: `wallet-admin-${suffix}`, name: "Wallet Admin" } });
    const adminPerms = await prisma.permission.findMany({ where: { key: { in: ["commission.read", "commission.adjust", "payout.read", "payout.approve", "payout.pay"] } } });
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `wallet-admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `wallet-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `wallet-noperm-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);

    const product = await prisma.product.create({ data: { name: `Wallet-test product ${suffix}`, slug: `wallet-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Wallet-test offer ${suffix}`, slug: `wallet-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: "Wallet-test campaign",
        slug: `wallet-test-campaign-${suffix}`,
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
    await prisma.commissionLedger.deleteMany({ where: { commission: { order: { offer: { slug: { contains: suffix } } } } } });
    await prisma.payout.deleteMany({ where: { creator: { displayName: { contains: "Wallet Creator" } } } });
    await prisma.payoutMethod.deleteMany({ where: { creator: { displayName: { contains: "Wallet Creator" } } } });
    await prisma.commission.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.commissionRule.deleteMany({ where: { campaignId } });
    await prisma.attribution.deleteMany({ where: { order: { offer: { slug: { contains: suffix } } } } });
    await prisma.order.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.customer.deleteMany({ where: { fullName: `Test Customer ${suffix}` } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.auditLog.deleteMany({ where: { entityType: { in: ["Commission", "Payout", "PayoutMethod"] } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("commission settlement lifecycle", () => {
    it("runs PENDING -> APPROVED -> PAYABLE, writing an ACCRUAL ledger entry at approval", async () => {
      const creator = await makeCreator("settlement");
      const { commission } = await makeCommission(creator.creatorId, 10_000_00, "PENDING");

      const approveRes = await request(app.getHttpServer())
        .post(`/admin/commissions/${commission.id}/approve`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);
      expect(approveRes.body.status).toBe("APPROVED");
      expect(approveRes.body.ledger).toEqual([expect.objectContaining({ type: "ACCRUAL", amountMinor: 10_000_00 })]);

      const payableRes = await request(app.getHttpServer())
        .post(`/admin/commissions/${commission.id}/mark-payable`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(201);
      expect(payableRes.body.status).toBe("PAYABLE");
      // No second ledger entry — PAYABLE doesn't re-accrue, it only marks withdrawability.
      expect(payableRes.body.ledger).toHaveLength(1);
    });

    it("rejects an APPROVED commission with a REVERSAL entry cancelling the earlier ACCRUAL", async () => {
      const creator = await makeCreator("rejectflow");
      const { commission } = await makeCommission(creator.creatorId, 5_000_00, "APPROVED");

      const res = await request(app.getHttpServer())
        .post(`/admin/commissions/${commission.id}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Order was fraudulent" })
        .expect(201);
      expect(res.body.status).toBe("REJECTED");
      expect(res.body.ledger).toEqual(expect.arrayContaining([expect.objectContaining({ type: "REVERSAL", amountMinor: -5_000_00 })]));
    });

    it("reverses a commission whose order was refunded (lazy sweep, no direct API for it)", async () => {
      const creator = await makeCreator("refundflow");
      const { order, commission } = await makeCommission(creator.creatorId, 8_000_00, "APPROVED");
      await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });

      // Any read/mutate entry point triggers the sweep — wallet balance is the simplest to hit.
      await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);

      const detail = await request(app.getHttpServer()).get(`/admin/commissions/${commission.id}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(detail.body.status).toBe("REFUNDED");
      expect(detail.body.ledger).toEqual(expect.arrayContaining([expect.objectContaining({ type: "REVERSAL", amountMinor: -8_000_00 })]));
    });
  });

  describe("wallet balance", () => {
    it("aggregates pending/available/paid/reversed correctly across mixed-status commissions", async () => {
      const creator = await makeCreator("balance");
      await makeCommission(creator.creatorId, 10_000_00, "PENDING");
      await makeCommission(creator.creatorId, 20_000_00, "PAYABLE");
      await makeCommission(creator.creatorId, 30_000_00, "PAID");

      const res = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(res.body).toMatchObject({ pendingMinor: 10_000_00, availableMinor: 20_000_00, lockedMinor: 0, paidMinor: 30_000_00, reversedMinor: 0 });
    });

    it("lists ledger transactions for the authenticated creator only", async () => {
      const creator = await makeCreator("ledger");
      await makeCommission(creator.creatorId, 15_000_00, "APPROVED");
      const res = await request(app.getHttpServer()).get("/creator/wallet/transactions").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0]).toMatchObject({ type: "ACCRUAL", amountMinor: 15_000_00 });
    });
  });

  describe("payout methods", () => {
    it("creates a masked CARD payout method and makes the first one default", async () => {
      const creator = await makeCreator("methods");
      const res = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Test Holder" })
        .expect(201);
      expect(res.body.label).toBe("•••• 9012 — Test Holder");
      expect(res.body.isDefault).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain("8600123456789012");
    });

    it("soft-deletes a payout method (deactivate), never a hard delete", async () => {
      const creator = await makeCreator("softdelete");
      const created = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Test" })
        .expect(201);
      await request(app.getHttpServer()).delete(`/creator/payout-methods/${created.body.id}`).set("Authorization", `Bearer ${creator.accessToken}`).expect(204);
      const list = await request(app.getHttpServer()).get("/creator/payout-methods").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(list.body).toHaveLength(0);
      const stillExists = await prisma.payoutMethod.findUnique({ where: { id: created.body.id } });
      expect(stillExists).not.toBeNull();
      expect(stillExists!.isActive).toBe(false);
    });
  });

  describe("full payout lifecycle: request -> approve -> processing -> paid", () => {
    it(
      "settles locked commissions to PAID with a PAYOUT ledger entry each",
      async () => {
        const creator = await makeCreator("fullpayout");
        await makeCommission(creator.creatorId, 60_000_00, "PAYABLE");
        await makeCommission(creator.creatorId, 60_000_00, "PAYABLE");
        const method = await request(app.getHttpServer())
          .post("/creator/payout-methods")
          .set("Authorization", `Bearer ${creator.accessToken}`)
          .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Full Payout" })
          .expect(201);

        const requestRes = await request(app.getHttpServer())
          .post("/creator/payouts")
          .set("Authorization", `Bearer ${creator.accessToken}`)
          .send({ amountMinor: 100_000_00, payoutMethodId: method.body.id })
          .expect(201);
        expect(requestRes.body.status).toBe("REQUESTED");

        const balanceAfterRequest = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
        expect(balanceAfterRequest.body.lockedMinor).toBe(120_000_00); // both commissions locked (FIFO covers 100k, locks both since neither alone covers it... actually first covers partially)
        expect(balanceAfterRequest.body.availableMinor).toBe(0);

        await request(app.getHttpServer()).post(`/admin/payouts/${requestRes.body.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
        await request(app.getHttpServer()).post(`/admin/payouts/${requestRes.body.id}/processing`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
        const paidRes = await request(app.getHttpServer()).post(`/admin/payouts/${requestRes.body.id}/paid`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
        expect(paidRes.body.status).toBe("PAID");

        const balanceAfterPaid = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
        expect(balanceAfterPaid.body.lockedMinor).toBe(0);
        expect(balanceAfterPaid.body.paidMinor).toBe(120_000_00);

        const auditActions = await prisma.auditLog.findMany({ where: { entityId: requestRes.body.id }, select: { action: true } });
        expect(auditActions.map((a) => a.action)).toEqual(expect.arrayContaining(["PAYOUT_REQUESTED", "PAYOUT_APPROVED", "PAYOUT_PROCESSING", "PAYOUT_PAID"]));
      },
      60_000,
    );
  });

  describe("payout rejection / cancellation / failure release locked commissions", () => {
    it("releases locked commissions back to available when admin rejects a payout", async () => {
      const creator = await makeCreator("rejectpayout");
      await makeCommission(creator.creatorId, 100_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Reject Test" })
        .expect(201);
      const payoutRes = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ amountMinor: 100_000_00, payoutMethodId: method.body.id })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/payouts/${payoutRes.body.id}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Suspicious withdrawal pattern" })
        .expect(201);

      const balance = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(balance.body.availableMinor).toBe(100_000_00);
      expect(balance.body.lockedMinor).toBe(0);
    });

    it("allows the creator to cancel their own REQUESTED payout, releasing locked commissions", async () => {
      const creator = await makeCreator("cancelpayout");
      await makeCommission(creator.creatorId, 100_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Cancel Test" })
        .expect(201);
      const payoutRes = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ amountMinor: 100_000_00, payoutMethodId: method.body.id })
        .expect(201);

      await request(app.getHttpServer()).post(`/creator/payouts/${payoutRes.body.id}/cancel`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);

      const balance = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(balance.body.availableMinor).toBe(100_000_00);
    });

    it("marks a PROCESSING payout FAILED and releases its locked commissions", async () => {
      const creator = await makeCreator("failedpayout");
      await makeCommission(creator.creatorId, 100_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Failed Test" })
        .expect(201);
      const payoutRes = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ amountMinor: 100_000_00, payoutMethodId: method.body.id })
        .expect(201);
      await request(app.getHttpServer()).post(`/admin/payouts/${payoutRes.body.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/payouts/${payoutRes.body.id}/processing`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      await request(app.getHttpServer())
        .post(`/admin/payouts/${payoutRes.body.id}/failed`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Bank account details invalid" })
        .expect(201);

      const balance = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(balance.body.availableMinor).toBe(100_000_00);
    });
  });

  describe("insufficient balance", () => {
    it("rejects a payout request exceeding the creator's available (unlocked PAYABLE) balance", async () => {
      const creator = await makeCreator("insufficient");
      await makeCommission(creator.creatorId, 50_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Insufficient Test" })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ amountMinor: 500_000_00, payoutMethodId: method.body.id })
        .expect(409);
      expect(res.body.code).toBe("INSUFFICIENT_BALANCE");
    });

    it("rejects a payout request below the configured minimum", async () => {
      const creator = await makeCreator("belowmin");
      await makeCommission(creator.creatorId, 500_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Below Min Test" })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ amountMinor: 1_00, payoutMethodId: method.body.id })
        .expect(400);
      expect(res.body.code).toBe("BELOW_MINIMUM");
    });
  });

  describe("RBAC", () => {
    it("rejects admin commission list access without commission.read", async () => {
      await request(app.getHttpServer()).get("/admin/commissions").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("rejects admin payout list access without payout.read", async () => {
      await request(app.getHttpServer()).get("/admin/payouts").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("rejects a creator cancelling another creator's payout (ownership, not RBAC)", async () => {
      const creatorA = await makeCreator("ownera");
      const creatorB = await makeCreator("ownerb");
      await makeCommission(creatorA.creatorId, 100_000_00, "PAYABLE");
      const method = await request(app.getHttpServer())
        .post("/creator/payout-methods")
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({ type: "CARD", cardNumber: "8600123456789012", cardHolder: "Owner A" })
        .expect(201);
      const payoutRes = await request(app.getHttpServer())
        .post("/creator/payouts")
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({ amountMinor: 100_000_00, payoutMethodId: method.body.id })
        .expect(201);

      const res = await request(app.getHttpServer()).post(`/creator/payouts/${payoutRes.body.id}/cancel`).set("Authorization", `Bearer ${creatorB.accessToken}`).expect(404);
      expect(res.body.code).toBe("PAYOUT_NOT_FOUND");
    });
  });
});
