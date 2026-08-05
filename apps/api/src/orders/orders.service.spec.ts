import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { OffersService } from "../offers/offers.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { DeliveryService } from "../delivery/delivery.service";
import { PromoCodesService } from "../promo-codes/promo-codes.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";
import type { CreateCheckoutDto } from "./dto/create-checkout.dto";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: {
    order: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    customer: { findFirst: jest.Mock };
    offer: { findUnique: jest.Mock };
    campaign: { findUnique: jest.Mock };
    promoCode: { findUnique: jest.Mock };
    referralLink: { findFirst: jest.Mock };
    referralVisit: { findFirst: jest.Mock };
    attribution: { findUnique: jest.Mock };
    flow: { findUnique: jest.Mock };
    refund: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    customer: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    address: { create: jest.Mock };
    order: { create: jest.Mock; update: jest.Mock };
    orderItem: { create: jest.Mock; findMany: jest.Mock };
    orderStatusHistory: { create: jest.Mock };
    attribution: { create: jest.Mock };
    campaign: { findUnique: jest.Mock };
    commissionRule: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    commission: { create: jest.Mock };
    offer: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock; update: jest.Mock };
    flow: { update: jest.Mock };
    payment: { updateMany: jest.Mock };
  };
  let offers: { computeAvailability: jest.Mock };
  let campaigns: { computeAvailability: jest.Mock };
  let delivery: { resolveDeliveryFee: jest.Mock };
  let promoCodes: { findAndAssertUsable: jest.Mock; commitUsage: jest.Mock };
  let referrals: { onQualifiedSale: jest.Mock };
  let audit: { record: jest.Mock };

  const physicalOffer = {
    id: "offer1",
    slug: "physical-offer",
    name: "Fizik taklif",
    priceMinor: 100_000_00,
    currency: "UZS",
    status: "ACTIVE",
    startsAt: null,
    expiresAt: null,
    paymentOptions: ["CLICK", "PAY_LATER", "COD"],
    product: { id: "product1", type: "PHYSICAL_PRODUCT", status: "ACTIVE", stockQuantity: 5 },
    landingPage: { status: "PUBLISHED", archivedAt: null },
    variants: [],
  };

  const validDto: CreateCheckoutDto = {
    paymentMethod: "CLICK",
    idempotencyKey: "idem-key-12345",
    customer: { fullName: "Aziz Karimov", phone: "+998901234567", region: "Toshkent", address: "Chilonzor 1" },
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      customer: { findFirst: jest.fn() },
      offer: { findUnique: jest.fn() },
      campaign: { findUnique: jest.fn() },
      promoCode: { findUnique: jest.fn() },
      referralLink: { findFirst: jest.fn() },
      referralVisit: { findFirst: jest.fn() },
      attribution: { findUnique: jest.fn() },
      flow: { findUnique: jest.fn().mockResolvedValue(null) },
      refund: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    tx = {
      customer: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      address: { create: jest.fn() },
      order: { create: jest.fn(), update: jest.fn() },
      orderItem: { create: jest.fn(), findMany: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      attribution: { create: jest.fn() },
      campaign: { findUnique: jest.fn() },
      commissionRule: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      commission: { create: jest.fn() },
      offer: { findUnique: jest.fn() },
      product: { findUnique: jest.fn(), update: jest.fn() },
      flow: { update: jest.fn() },
      payment: { updateMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    offers = { computeAvailability: jest.fn().mockReturnValue("LIVE") };
    campaigns = { computeAvailability: jest.fn().mockReturnValue("LIVE") };
    delivery = { resolveDeliveryFee: jest.fn().mockResolvedValue({ deliveryFeeMinor: 0, regionRequired: false, regionCode: null, regionName: null, estimatedMinDays: null, estimatedMaxDays: null }) };
    promoCodes = { findAndAssertUsable: jest.fn(), commitUsage: jest.fn() };
    referrals = { onQualifiedSale: jest.fn() };
    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OffersService, useValue: offers },
        { provide: CampaignsService, useValue: campaigns },
        { provide: DeliveryService, useValue: delivery },
        { provide: PromoCodesService, useValue: promoCodes },
        { provide: ReferralsService, useValue: referrals },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  function mockFullOrderLookup(overrides: Record<string, unknown> = {}) {
    return {
      id: "order1",
      publicToken: "public-token-1",
      status: "CREATED",
      type: "PHYSICAL",
      offer: { id: "offer1", name: "Fizik taklif", slug: "physical-offer", product: { images: [] } },
      campaign: null,
      customer: { id: "customer1", fullName: "Aziz Karimov", phone: "+998901234567", email: null },
      address: null,
      items: [{ id: "item1", nameSnapshot: "Fizik taklif", quantity: 1, unitPriceMinor: 100_000_00, totalMinor: 100_000_00 }],
      statusHistory: [],
      payment: null,
      shipment: null,
      attribution: null,
      commission: null,
      refunds: [],
      subtotalMinor: 100_000_00,
      discountMinor: 0,
      shippingMinor: 0,
      totalMinor: 100_000_00,
      currency: "UZS",
      deliveryMethod: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe("createOrder", () => {
    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(null); // no idempotency replay by default
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      tx.customer.findFirst.mockResolvedValue(null);
      tx.customer.create.mockResolvedValue({ id: "customer1" });
      tx.address.create.mockResolvedValue({ id: "address1" });
      tx.order.create.mockResolvedValue({ id: "order1", totalMinor: 100_000_00 });
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockFullOrderLookup());
    });

    it("creates an order with the offer's price when no attribution is present", async () => {
      const result = await service.createOrder("physical-offer", validDto);
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subtotalMinor: 100_000_00, discountMinor: 0, totalMinor: 100_000_00, campaignId: null }) }),
      );
      expect(result.paymentProvider).toBe("CLICK");
      expect(tx.attribution.create).not.toHaveBeenCalled();
    });

    it("replays an existing order instead of creating a duplicate when idempotencyKey matches", async () => {
      prisma.order.findUnique.mockResolvedValue(mockFullOrderLookup());
      const result = await service.createOrder("physical-offer", validDto);
      expect(tx.order.create).not.toHaveBeenCalled();
      expect(result.orderId).toBe("order1");
    });

    it("rejects with OFFER_INACTIVE when the offer isn't LIVE", async () => {
      offers.computeAvailability.mockReturnValue("EXPIRED");
      await expect(service.createOrder("physical-offer", validDto)).rejects.toMatchObject({ code: "OFFER_INACTIVE" });
    });

    it("rejects with PRODUCT_ARCHIVED when the underlying product is archived", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...physicalOffer, product: { ...physicalOffer.product, status: "ARCHIVED" } });
      await expect(service.createOrder("physical-offer", validDto)).rejects.toMatchObject({ code: "PRODUCT_ARCHIVED" });
    });

    it("rejects with OFFER_INACTIVE when the landing page isn't published", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...physicalOffer, landingPage: { status: "DRAFT", archivedAt: null } });
      await expect(service.createOrder("physical-offer", validDto)).rejects.toMatchObject({ code: "OFFER_INACTIVE" });
    });

    it("rejects with OUT_OF_STOCK when stockQuantity is below the requested quantity", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...physicalOffer, product: { ...physicalOffer.product, stockQuantity: 0 } });
      await expect(service.createOrder("physical-offer", validDto)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    });

    it("rejects with CUSTOMER_INFO_INVALID when a physical order is missing region/address", async () => {
      const dto: CreateCheckoutDto = { ...validDto, customer: { fullName: "Aziz", phone: "+998901234567" } };
      await expect(service.createOrder("physical-offer", dto)).rejects.toMatchObject({ code: "CUSTOMER_INFO_INVALID" });
    });

    it("rejects with PAYMENT_METHOD_NOT_SUPPORTED when the method isn't in the offer's paymentOptions", async () => {
      const dto: CreateCheckoutDto = { ...validDto, paymentMethod: "PAYME" };
      await expect(service.createOrder("physical-offer", dto)).rejects.toMatchObject({ code: "PAYMENT_METHOD_NOT_SUPPORTED" });
    });

    it("resolves PAY_LATER to the MANUAL provider", async () => {
      const dto: CreateCheckoutDto = { ...validDto, paymentMethod: "PAY_LATER" };
      const result = await service.createOrder("physical-offer", dto);
      expect(result.paymentProvider).toBe("MANUAL");
    });

    it("resolves COD to the CASH_ON_DELIVERY provider (Phase F)", async () => {
      const dto: CreateCheckoutDto = { ...validDto, paymentMethod: "COD" };
      const result = await service.createOrder("physical-offer", dto);
      expect(result.paymentProvider).toBe("CASH_ON_DELIVERY");
    });

    it("attributes the sale to a creator and snapshots a commission when a valid refCode is given", async () => {
      prisma.referralLink.findFirst.mockResolvedValue({ id: "link1", offerId: "offer1", creatorId: "creator1", campaignId: "campaign1", status: "ACTIVE", expiresAt: null });
      prisma.campaign.findUnique.mockResolvedValue({ status: "ACTIVE", startDate: null, endDate: null });
      tx.campaign.findUnique.mockResolvedValue({ id: "campaign1", commissionType: "PERCENTAGE", commissionRateBps: 1000, commissionAmountMinor: null });
      tx.commissionRule.findFirst.mockResolvedValue(null);
      tx.commissionRule.create.mockResolvedValue({ id: "rule1", commissionType: "PERCENTAGE", commissionRateBps: 1000, commissionAmountMinor: null });

      const dto: CreateCheckoutDto = { ...validDto, refCode: "malika-serum" };
      await service.createOrder("physical-offer", dto);

      expect(tx.attribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ creatorId: "creator1", campaignId: "campaign1", source: "REFERRAL_VISIT" }) }),
      );
      expect(tx.commission.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ creatorId: "creator1", amountMinor: 10_000_00 }) }));
    });

    it("attributes the sale to a Flow's creator, computes commission from the Product's own fields, and increments the Flow's stats", async () => {
      prisma.flow.findUnique.mockResolvedValue({ id: "flow1", creatorProfileId: "creator2", productId: "product1", status: "ACTIVE" });
      tx.product.findUnique.mockResolvedValue({ id: "product1", commissionType: "PERCENTAGE", commissionRateBps: 1500, commissionAmountMinor: null });

      const dto: CreateCheckoutDto = { ...validDto, refCode: "flow-code-1" };
      await service.createOrder("physical-offer", dto);

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ flowId: "flow1", referralCode: "flow-code-1", productId: "product1" }) }),
      );
      expect(tx.attribution.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ creatorId: "creator2", campaignId: null, source: "FLOW" }) }),
      );
      expect(tx.commission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ creatorId: "creator2", commissionRuleId: null, amountMinor: 15_000_00 }) }),
      );
      expect(tx.flow.update).toHaveBeenCalledWith({ where: { id: "flow1" }, data: { orderCount: { increment: 1 }, commissionEarnedMinor: { increment: 15_000_00 } } });
      // Flow resolves before the legacy ReferralLink lookup — no need to even query it.
      expect(prisma.referralLink.findFirst).not.toHaveBeenCalled();
    });

    it("rejects with REFERRAL_CODE_INVALID for an unknown/mismatched refCode", async () => {
      prisma.referralLink.findFirst.mockResolvedValue(null);
      const dto: CreateCheckoutDto = { ...validDto, refCode: "bad-code" };
      await expect(service.createOrder("physical-offer", dto)).rejects.toMatchObject({ code: "REFERRAL_CODE_INVALID" });
    });

    it("applies a promo code's discount and commits its usage", async () => {
      promoCodes.findAndAssertUsable.mockResolvedValue({ promo: { id: "promo1" }, discountMinor: 10_000_00 });
      const dto: CreateCheckoutDto = { ...validDto, promoCode: "MALIKA10" };
      await service.createOrder("physical-offer", dto);
      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ discountMinor: 10_000_00, totalMinor: 90_000_00 }) }));
      expect(promoCodes.commitUsage).toHaveBeenCalledWith(tx, "promo1", "order1", "customer1");
    });

    describe("buyer reconciliation (Phase D)", () => {
      it("guest checkout (no buyerUserId) never looks up Customer by userId", async () => {
        await service.createOrder("physical-offer", validDto);
        expect(tx.customer.findFirst).toHaveBeenCalledWith({ where: { phone: validDto.customer.phone }, orderBy: { createdAt: "desc" } });
      });

      it("logged-in buyer with an already-linked Customer updates that row, never creates a new one", async () => {
        tx.customer.findFirst.mockResolvedValueOnce({ id: "linked-customer-1", userId: "buyer1", email: null });
        tx.customer.update.mockResolvedValue({ id: "linked-customer-1" });
        await service.createOrder("physical-offer", validDto, "buyer1");
        expect(tx.customer.findFirst).toHaveBeenCalledWith({ where: { userId: "buyer1" } });
        expect(tx.customer.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: "linked-customer-1" } }),
        );
        expect(tx.customer.create).not.toHaveBeenCalled();
      });

      it("logged-in buyer with no linked Customer, but a matching guest row by phone, links (not duplicates) that row", async () => {
        tx.customer.findFirst
          .mockResolvedValueOnce(null) // no Customer linked to this userId yet
          .mockResolvedValueOnce({ id: "guest-customer-1", phone: validDto.customer.phone, userId: null, email: null }); // guest match by phone
        tx.customer.update.mockResolvedValue({ id: "guest-customer-1" });
        await service.createOrder("physical-offer", validDto, "buyer1");
        expect(tx.customer.update).toHaveBeenCalledWith({
          where: { id: "guest-customer-1" },
          data: expect.objectContaining({ userId: "buyer1" }),
        });
        expect(tx.customer.create).not.toHaveBeenCalled();
      });

      it("logged-in buyer with no linked Customer and no guest match creates a new Customer with userId set", async () => {
        tx.customer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        await service.createOrder("physical-offer", validDto, "buyer1");
        expect(tx.customer.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ userId: "buyer1" }),
        });
      });
    });
  });

  describe("transitionStatus", () => {
    it("rejects an illegal transition with INVALID_ORDER_TRANSITION", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "DELIVERED" });
      await expect(service.transitionStatus("order1", "CREATED", null)).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION" });
    });

    it("allows CREATED -> PAYMENT_PENDING and records status history", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "CREATED" });
      tx.order.update.mockResolvedValue({ id: "order1", status: "PAYMENT_PENDING" });
      await service.transitionStatus("order1", "PAYMENT_PENDING", null);
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fromStatus: "CREATED", toStatus: "PAYMENT_PENDING" }) }),
      );
    });

    // Regression: caught by browser verification — createRefund's eligibility list
    // (PAID/PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED) must have a matching REFUNDED edge in
    // TRANSITIONS for every one of those states, or a full refund 409s on exactly the states it
    // claims are refund-eligible.
    it.each(["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"] as const)(
      "allows %s -> REFUNDED directly",
      async (from) => {
        prisma.order.findUnique.mockResolvedValue({ id: "order1", status: from });
        tx.order.update.mockResolvedValue({ id: "order1", status: "REFUNDED" });
        await expect(service.transitionStatus("order1", "REFUNDED", "admin1")).resolves.toBeDefined();
      },
    );
  });

  describe("markPaid", () => {
    it("transitions to PAID, reserves stock, and fires the referral hook when attribution exists", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAYMENT_PENDING" });
      tx.orderItem.findMany.mockResolvedValue([{ id: "item1", quantity: 1, order: { offerId: "offer1" } }]);
      tx.offer.findUnique.mockResolvedValue({ productId: "product1" });
      tx.product.findUnique.mockResolvedValue({ type: "PHYSICAL_PRODUCT", stockQuantity: 5 });
      prisma.attribution.findUnique.mockResolvedValue({ creatorId: "creator1" });

      await service.markPaid("order1");

      expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "product1" }, data: { stockQuantity: { decrement: 1 } } });
      expect(referrals.onQualifiedSale).toHaveBeenCalledWith("creator1", "order1");
      // Regression: an admin manually approving a Pay Later order calls markPaid directly, with
      // no prior Click-callback step that would have already marked the Payment row PAID —
      // markPaid itself must be the one place that keeps Payment.status in sync with Order.status.
      expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { orderId: "order1", status: { not: "PAID" } }, data: { status: "PAID" } });
    });

    it("is a no-op when the order is already PAID (replay protection)", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAID" });
      await service.markPaid("order1");
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(referrals.onQualifiedSale).not.toHaveBeenCalled();
    });

    it("throws OUT_OF_STOCK instead of overselling when stock ran out between checkout and payment", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAYMENT_PENDING" });
      tx.orderItem.findMany.mockResolvedValue([{ id: "item1", quantity: 2, order: { offerId: "offer1" } }]);
      tx.offer.findUnique.mockResolvedValue({ productId: "product1" });
      tx.product.findUnique.mockResolvedValue({ type: "PHYSICAL_PRODUCT", stockQuantity: 1 });
      await expect(service.markPaid("order1")).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    });
  });

  describe("markPaymentFailed", () => {
    it("cancels the order and records the failure reason", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAYMENT_PENDING" });
      tx.order.update.mockResolvedValue({ id: "order1", status: "CANCELLED" });
      await service.markPaymentFailed("order1", "insufficient funds");
      expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "order1" }, data: { status: "CANCELLED" } });
    });
  });

  describe("adminUpdateStatus", () => {
    // Regression: caught by browser verification — the admin UI's plain status-update button must
    // never be able to set REFUNDED directly, since that path skips creating a Refund record and
    // skips releasing stock. Only createRefund may reach REFUNDED.
    it("rejects a direct REFUNDED target — must go through createRefund instead", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAID" });
      await expect(service.adminUpdateStatus("order1", "REFUNDED", "admin1", undefined)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    // Regression: an admin manually approving a Pay Later order must trigger the exact same
    // consequences a real Click callback would (stock reservation, referral hook) — routing this
    // through the generic transitionStatus() instead of markPaid() would silently skip both.
    it("routes a PAID target through markPaid — reserves stock, not just a bare status flip", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: "order1", status: "PAYMENT_PENDING" }) // markPaid's own lookup
        .mockResolvedValueOnce(mockFullOrderLookup({ status: "PAID" })); // final findOneOrThrow
      tx.orderItem.findMany.mockResolvedValue([{ id: "item1", quantity: 1, order: { offerId: "offer1" } }]);
      tx.offer.findUnique.mockResolvedValue({ productId: "product1" });
      tx.product.findUnique.mockResolvedValue({ type: "PHYSICAL_PRODUCT", stockQuantity: 5 });
      prisma.attribution.findUnique.mockResolvedValue(null);

      await service.adminUpdateStatus("order1", "PAID", "admin1", "Cash confirmed by phone");

      expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "product1" }, data: { stockQuantity: { decrement: 1 } } });
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ toStatus: "PAID", changedById: "admin1", note: "Cash confirmed by phone" }) }),
      );
    });
  });

  describe("createRefund", () => {
    it("rejects REFUND_NOT_ELIGIBLE for an order that was never paid", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "CREATED", totalMinor: 100_000_00 });
      await expect(service.createRefund("order1", { amountMinor: 1000, reason: "test" }, "admin1")).rejects.toMatchObject({ code: "REFUND_NOT_ELIGIBLE" });
    });

    it("rejects a refund amount larger than the order total", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: "order1", status: "PAID", totalMinor: 100_000_00 });
      await expect(service.createRefund("order1", { amountMinor: 200_000_00, reason: "test" }, "admin1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("transitions to REFUNDED and releases stock for a full-amount refund", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: "order1", status: "PAID", totalMinor: 100_000_00 }) // createRefund's own eligibility check
        .mockResolvedValueOnce({ id: "order1", status: "PAID" }) // transitionStatus's guard
        .mockResolvedValueOnce(mockFullOrderLookup({ status: "REFUNDED" })); // final findOneOrThrow
      tx.orderItem.findMany.mockResolvedValue([{ id: "item1", quantity: 1, order: { offerId: "offer1" } }]);
      tx.offer.findUnique.mockResolvedValue({ productId: "product1" });
      tx.product.findUnique.mockResolvedValue({ type: "PHYSICAL_PRODUCT", stockQuantity: 4 });
      tx.order.update.mockResolvedValue({ id: "order1", status: "REFUNDED" });

      await service.createRefund("order1", { amountMinor: 100_000_00, reason: "customer changed mind" }, "admin1");

      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountMinor: 100_000_00, status: "REQUESTED" }) }),
      );
      expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "product1" }, data: { stockQuantity: { increment: 1 } } });
    });
  });

  describe("listForBuyer / findOneForBuyerOrThrow (Phase D)", () => {
    it("returns an empty list, not an error, when the buyer has no linked Customer yet", async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.listForBuyer("buyer1")).resolves.toEqual([]);
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it("scopes the order list to the buyer's own linked Customer only", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer1" });
      prisma.order.findMany.mockResolvedValue([mockFullOrderLookup()]);
      const result = await service.listForBuyer("buyer1");
      expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: "customer1" } }));
      expect(result).toHaveLength(1);
    });

    it("Phase G: fetches only the fields the summary actually needs — not the full ORDER_INCLUDE (items/statusHistory/attribution/commission/refunds/campaign/customer/address/shipment)", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer1" });
      prisma.order.findMany.mockResolvedValue([]);
      await service.listForBuyer("buyer1");
      const args = prisma.order.findMany.mock.calls[0][0];
      expect(args.include).toBeUndefined();
      expect(args.select).toEqual(
        expect.objectContaining({
          id: true,
          publicToken: true,
          status: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
          offer: { select: { name: true } },
          payment: { select: { provider: true, status: true } },
        }),
      );
      // The over-fetched relations this replaced must genuinely not be requested.
      expect(args.select.items).toBeUndefined();
      expect(args.select.statusHistory).toBeUndefined();
      expect(args.select.attribution).toBeUndefined();
      expect(args.select.commission).toBeUndefined();
      expect(args.select.refunds).toBeUndefined();
      expect(args.select.campaign).toBeUndefined();
      expect(args.select.customer).toBeUndefined();
      expect(args.select.address).toBeUndefined();
      expect(args.select.shipment).toBeUndefined();
    });

    it("404s (ORDER_NOT_FOUND) for an order that belongs to a different buyer — never leaks that it exists", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer1" });
      prisma.order.findUnique.mockResolvedValue(mockFullOrderLookup({ customerId: "someone-elses-customer" }));
      await expect(service.findOneForBuyerOrThrow("buyer1", "order1")).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    });

    it("404s the same way for an order that doesn't exist at all", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer1" });
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOneForBuyerOrThrow("buyer1", "missing")).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    });

    it("returns the full detail shape for an order the buyer actually owns", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: "customer1" });
      prisma.order.findUnique.mockResolvedValue(mockFullOrderLookup({ customerId: "customer1" }));
      const result = await service.findOneForBuyerOrThrow("buyer1", "order1");
      expect(result.id).toBe("order1");
      expect(result.items).toHaveLength(1);
    });
  });
});
