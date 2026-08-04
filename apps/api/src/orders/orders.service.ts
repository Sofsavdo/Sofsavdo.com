import { Injectable } from "@nestjs/common";
import type { Order, OrderStatus, PaymentProviderType, Prisma, ProductType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OffersService } from "../offers/offers.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { DeliveryService } from "../delivery/delivery.service";
import { PromoCodesService } from "../promo-codes/promo-codes.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { applyBasisPoints } from "../common/money/money";
import type { CreateCheckoutDto } from "./dto/create-checkout.dto";
import type { CustomerInfoDto } from "./dto/customer-info.dto";
import type { OrderQueryDto } from "./dto/order-query.dto";
import type { CreateRefundDto } from "./dto/create-refund.dto";

const ORDER_INCLUDE = {
  offer: { select: { id: true, name: true, slug: true } },
  campaign: { select: { id: true, name: true, slug: true } },
  customer: true,
  address: true,
  items: true,
  statusHistory: { orderBy: { createdAt: "asc" } },
  payment: true,
  shipment: true,
  attribution: { include: { referralVisit: { select: { id: true } } } },
  commission: { include: { creator: { select: { id: true, displayName: true } } } },
  refunds: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

// Public/customer-facing shape (order-success page) — no internal notes, no attribution/
// commission internals, no full status history.
export interface PublicOrderResponse {
  publicToken: string;
  status: OrderStatus;
  offerName: string;
  variantName: string | null;
  customer: { fullName: string; phone: string };
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  paymentRedirectUrl: string | null;
}

// Buyer-facing shape — a real order-detail view (unlike PublicOrderResponse's order-success-page
// summary), but never the admin internals: no attribution/commission (who referred this buyer and
// what they earned is not the buyer's business), no internal notes.
export interface BuyerOrderSummary {
  id: string;
  publicToken: string;
  status: OrderStatus;
  offerName: string;
  totalMinor: number;
  currency: string;
  createdAt: Date;
  // Cheap to include — ORDER_INCLUDE already fetches `payment` for every order in this query, so
  // this costs nothing extra and lets the buyer's Purchases/Payment-History pages work off the
  // list response alone, without an N+1 per-order detail fetch just to show a payment provider.
  payment: { provider: string; status: string } | null;
}

export interface BuyerOrderDetail extends BuyerOrderSummary {
  offer: { id: string; name: string; slug: string } | null;
  items: { id: string; nameSnapshot: string; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  address: { region: string; city: string; district: string | null; line1: string; comment: string | null } | null;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  payment: { provider: string; status: string } | null;
  statusHistory: { toStatus: OrderStatus; createdAt: Date }[];
}

export interface AdminOrderResponse {
  id: string;
  publicToken: string;
  status: OrderStatus;
  type: string;
  offer: { id: string; name: string; slug: string } | null;
  campaign: { id: string; name: string; slug: string } | null;
  customer: { id: string; fullName: string; phone: string; email: string | null };
  address: { region: string; city: string; district: string | null; line1: string; comment: string | null } | null;
  items: { id: string; nameSnapshot: string; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  deliveryMethod: string | null;
  secondPhone: string | null;
  notes: string | null;
  attribution: { creatorId: string; campaignId: string | null; source: string } | null;
  commission: { id: string; creatorId: string; creatorName: string; amountMinor: number; status: string } | null;
  payment: { id: string; provider: string; status: string; amountMinor: number; providerReference: string | null } | null;
  statusHistory: { fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: Date }[];
  refunds: { id: string; amountMinor: number; reason: string; status: string; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

// Explicit transition matrix — mirrors ContentService's ALLOWED_TRANSITIONS convention. CANCELLED
// and REFUNDED are terminal (no outgoing edges) — matches Offer/Content's "archival is one-way"
// pattern used throughout this codebase.
// REFUNDED is reachable from every post-payment state (PAID..DELIVERED), not just PAID/DELIVERED —
// a customer can request a refund any time before or after fulfillment completes, and
// createRefund's own eligibility check (PAID/PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED) must have a
// matching edge here for every one of those states or a full refund 409s with
// INVALID_ORDER_TRANSITION on exactly the states it claims are refund-eligible.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED", "CANCELLED", "REFUNDED"],
  IN_TRANSIT: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

function mapProductTypeToOrderType(productType: ProductType): "PHYSICAL" | "DIGITAL" | "COURSE" | "SERVICE" | "LEAD" {
  switch (productType) {
    case "PHYSICAL_PRODUCT":
      return "PHYSICAL";
    case "DIGITAL_PRODUCT":
      return "DIGITAL";
    case "COURSE":
      return "COURSE";
    case "SERVICE":
      return "SERVICE";
    case "CONSULTATION":
      return "LEAD";
  }
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private offers: OffersService,
    private campaigns: CampaignsService,
    private delivery: DeliveryService,
    private promoCodes: PromoCodesService,
    private referrals: ReferralsService,
    private audit: AuditService,
  ) {}

  // ---- Response mapping ----

  private toPublicResponse(order: OrderWithRelations, paymentRedirectUrl: string | null = null): PublicOrderResponse {
    const item = order.items[0];
    return {
      publicToken: order.publicToken,
      status: order.status,
      offerName: order.offer?.name ?? "Unknown",
      variantName: item?.nameSnapshot !== order.offer?.name ? (item?.nameSnapshot ?? null) : null,
      customer: { fullName: order.customer.fullName, phone: order.customer.phone },
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      shippingMinor: order.shippingMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      paymentRedirectUrl,
    };
  }

  toAdminResponse(order: OrderWithRelations): AdminOrderResponse {
    return {
      id: order.id,
      publicToken: order.publicToken,
      status: order.status,
      type: order.type,
      offer: order.offer ? { id: order.offer.id, name: order.offer.name, slug: order.offer.slug } : null,
      campaign: order.campaign ? { id: order.campaign.id, name: order.campaign.name, slug: order.campaign.slug } : null,
      customer: { id: order.customer.id, fullName: order.customer.fullName, phone: order.customer.phone, email: order.customer.email },
      address: order.address
        ? { region: order.address.region, city: order.address.city, district: order.address.district, line1: order.address.line1, comment: order.address.comment }
        : null,
      items: order.items.map((i) => ({ id: i.id, nameSnapshot: i.nameSnapshot, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor, totalMinor: i.totalMinor })),
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      shippingMinor: order.shippingMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      deliveryMethod: order.deliveryMethod,
      secondPhone: order.secondPhone,
      notes: order.notes,
      attribution: order.attribution ? { creatorId: order.attribution.creatorId, campaignId: order.attribution.campaignId, source: order.attribution.source } : null,
      commission: order.commission
        ? { id: order.commission.id, creatorId: order.commission.creatorId, creatorName: order.commission.creator.displayName, amountMinor: order.commission.amountMinor, status: order.commission.status }
        : null,
      payment: order.payment
        ? { id: order.payment.id, provider: order.payment.provider, status: order.payment.status, amountMinor: order.payment.amountMinor, providerReference: order.payment.providerReference }
        : null,
      statusHistory: order.statusHistory.map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note, createdAt: h.createdAt })),
      refunds: order.refunds.map((r) => ({ id: r.id, amountMinor: r.amountMinor, reason: r.reason, status: r.status, createdAt: r.createdAt })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toBuyerSummary(order: OrderWithRelations): BuyerOrderSummary {
    return {
      id: order.id,
      publicToken: order.publicToken,
      status: order.status,
      offerName: order.offer?.name ?? "Unknown",
      totalMinor: order.totalMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      payment: order.payment ? { provider: order.payment.provider, status: order.payment.status } : null,
    };
  }

  private toBuyerDetail(order: OrderWithRelations): BuyerOrderDetail {
    return {
      ...this.toBuyerSummary(order),
      offer: order.offer,
      items: order.items.map((i) => ({ id: i.id, nameSnapshot: i.nameSnapshot, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor, totalMinor: i.totalMinor })),
      address: order.address
        ? { region: order.address.region, city: order.address.city, district: order.address.district, line1: order.address.line1, comment: order.address.comment }
        : null,
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      shippingMinor: order.shippingMinor,
      payment: order.payment ? { provider: order.payment.provider, status: order.payment.status } : null,
      statusHistory: order.statusHistory.map((h) => ({ toStatus: h.toStatus, createdAt: h.createdAt })),
    };
  }

  // ---- Buyer-facing reads (Phase D) ----

  // No linked Customer yet (registered but never checked out, and no guest phone-match happened
  // at registration) is a real, valid state — an empty order list, not an error.
  //
  // Phase G finding: this used to reuse the full ORDER_INCLUDE (10 relations — campaign, customer,
  // address, items, statusHistory, attribution, commission, refunds, shipment, payment) even
  // though BuyerOrderSummary only ever reads offer.name/status/totalMinor/currency/payment/
  // createdAt/publicToken. A buyer with many orders was paying real DB + deserialization cost for
  // items/statusHistory/attribution/etc. arrays on every single row, discarded immediately by
  // toBuyerSummary. Selecting only what the summary actually needs is a real fix, not a
  // micro-optimization — the detail read below still needs (and keeps) the full include.
  async listForBuyer(userId: string): Promise<BuyerOrderSummary[]> {
    const customer = await this.prisma.customer.findFirst({ where: { userId } });
    if (!customer) return [];
    const orders = await this.prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicToken: true,
        status: true,
        totalMinor: true,
        currency: true,
        createdAt: true,
        offer: { select: { name: true } },
        payment: { select: { provider: true, status: true } },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      publicToken: o.publicToken,
      status: o.status,
      offerName: o.offer?.name ?? "Unknown",
      totalMinor: o.totalMinor,
      currency: o.currency,
      createdAt: o.createdAt,
      payment: o.payment ? { provider: o.payment.provider, status: o.payment.status } : null,
    }));
  }

  async findOneForBuyerOrThrow(userId: string, orderId: string): Promise<BuyerOrderDetail> {
    const customer = await this.prisma.customer.findFirst({ where: { userId } });
    if (!customer) throw new DomainException("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    // Same 404 for "doesn't exist" and "exists but belongs to someone else" — never leak which
    // case it is to an unauthorized caller (same convention as every other ownership-scoped read
    // in this codebase, e.g. CreatorSalesController).
    if (!order || order.customerId !== customer.id) throw new DomainException("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
    return this.toBuyerDetail(order);
  }

  // ---- Validation helpers ----

  // Only region is required for a physical product now, matching the 100k.uz-style checkout this
  // was rebuilt from: name, phone, region — the operator calls the buyer to confirm the exact
  // street address afterward rather than requiring it typed in at order time. `address` is still
  // accepted and stored (see the Address.create below) whenever the buyer does fill it in.
  private assertCustomerInfoValid(customer: CustomerInfoDto, productType: ProductType): void {
    if (productType === "PHYSICAL_PRODUCT" && !customer.region?.trim()) {
      throw new DomainException("CUSTOMER_INFO_INVALID", "Jismoniy mahsulot uchun yetkazib berish hududi tanlanishi shart.", {
        fields: ["region"],
      });
    }
  }

  // Phase F: broadened from "CLICK" | "MANUAL" to the full PaymentProviderType now that a
  // registry (PaymentsModule/PaymentsService) exists instead of one hardcoded adapter — see
  // DECISIONS.md's Phase F ADR. PAYME/CARD/UZUM_NASIYA still have no adapter behind them yet and
  // stay rejected (spec: never a fake success path); COD does now, proving the registry works for
  // a second real provider, not just Click.
  private resolvePaymentProvider(paymentMethod: string, offerPaymentOptions: string[]): PaymentProviderType {
    if (!offerPaymentOptions.includes(paymentMethod)) {
      throw new DomainException("PAYMENT_METHOD_NOT_SUPPORTED", "Ushbu to'lov usuli bu taklif uchun mavjud emas.", { paymentMethod });
    }
    if (paymentMethod === "CLICK") return "CLICK";
    if (paymentMethod === "PAY_LATER") return "MANUAL";
    if (paymentMethod === "COD") return "CASH_ON_DELIVERY";
    // PAYME/CARD — offer-configurable labels with no adapter behind them yet (spec: never a fake
    // success path for a provider that isn't actually integrated).
    throw new DomainException("PAYMENT_METHOD_NOT_SUPPORTED", "Ushbu to'lov usuli hozircha qo'llab-quvvatlanmaydi.", { paymentMethod });
  }

  private async resolveAttribution(
    offerId: string,
    refCode: string | undefined,
    promoCode: string | undefined,
    visitorId: string | undefined,
  ): Promise<{ source: "PROMO_CODE" | "REFERRAL_VISIT" | "FLOW"; creatorId: string; campaignId: string | null; referralVisitId: string | null; flowId: string | null; productId: string | null } | null> {
    const now = new Date();

    // Promo code takes priority when both are somehow present — it carries its own creator/
    // campaign directly, so it's the more specific signal.
    if (promoCode) {
      const promo = await this.prisma.promoCode.findUnique({ where: { code: promoCode.trim().toUpperCase() } });
      if (promo && promo.offerId === offerId && promo.isActive) {
        const campaign = await this.prisma.campaign.findUnique({ where: { id: promo.campaignId }, select: { status: true, startDate: true, endDate: true } });
        if (campaign && this.campaigns.computeAvailability(campaign) !== "EXPIRED" && campaign.status === "ACTIVE") {
          return { source: "PROMO_CODE", creatorId: promo.creatorId, campaignId: promo.campaignId, referralVisitId: null, flowId: null, productId: null };
        }
      }
      // An invalid/expired promo code used purely as an attribution signal (not for discount) is
      // ignored rather than rejecting checkout — PromoCodesService.findAndAssertUsable is the
      // authoritative gate for the *discount*; this path only decides creator credit.
    }

    if (refCode) {
      // First try Flow-based referral (simplified architecture)
      const flow = await this.prisma.flow.findUnique({ where: { referralCode: refCode } });
      if (flow && flow.status === "ACTIVE") {
        // For Flow-based attribution, we don't need campaign or referralVisit
        return { source: "FLOW", creatorId: flow.creatorProfileId, campaignId: null, referralVisitId: null, flowId: flow.id, productId: flow.productId };
      }

      // Fallback to legacy Campaign-based referral
      const link = await this.prisma.referralLink.findUnique({ where: { code: refCode } });
      if (!link || link.offerId !== offerId || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt < now)) {
        throw new DomainException("REFERRAL_CODE_INVALID", "Referral havola yaroqsiz yoki muddati tugagan.");
      }
      const campaign = await this.prisma.campaign.findUnique({ where: { id: link.campaignId }, select: { status: true, startDate: true, endDate: true } });
      if (!campaign || campaign.status !== "ACTIVE" || this.campaigns.computeAvailability(campaign) === "EXPIRED") {
        throw new DomainException("CAMPAIGN_ARCHIVED", "Ushbu referral havola tegishli kampaniya endi faol emas.");
      }

      let referralVisitId: string | null = null;
      if (visitorId) {
        const visit = await this.prisma.referralVisit.findFirst({
          where: { visitorId, referralLinkId: link.id, offerId, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        });
        referralVisitId = visit?.id ?? null;
      }
      return { source: "REFERRAL_VISIT", creatorId: link.creatorId, campaignId: link.campaignId, referralVisitId, flowId: null, productId: null };
    }

    return null;
  }

  // Effective-dated snapshot pattern (see schema comment on CommissionRule): reuse the campaign's
  // currently-open commission rule if its values still match live Campaign config; otherwise close
  // the old one out and start a new one. Keeps one open CommissionRule row per campaign at a time
  // instead of a fresh row per order.
  private async getOrCreateCurrentCommissionRule(
    tx: Prisma.TransactionClient,
    campaign: { id: string; commissionType: string; commissionRateBps: number | null; commissionAmountMinor: number | null },
  ) {
    const now = new Date();
    const current = await tx.commissionRule.findFirst({ where: { campaignId: campaign.id, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    if (
      current &&
      current.commissionType === campaign.commissionType &&
      current.commissionRateBps === campaign.commissionRateBps &&
      current.commissionAmountMinor === campaign.commissionAmountMinor
    ) {
      return current;
    }
    if (current) {
      await tx.commissionRule.update({ where: { id: current.id }, data: { effectiveTo: now } });
    }
    return tx.commissionRule.create({
      data: {
        campaignId: campaign.id,
        commissionType: campaign.commissionType as "PERCENTAGE" | "FIXED_AMOUNT",
        commissionRateBps: campaign.commissionRateBps,
        commissionAmountMinor: campaign.commissionAmountMinor,
        effectiveFrom: now,
      },
    });
  }

  // `buyerUserId` is set only when checkout was called with a valid logged-in buyer session (see
  // PublicCheckoutController's @OptionalAuth() route) — undefined for a true guest checkout.
  // Authenticated-first lookup, falling back to today's phone-match for guests: a Customer row is
  // never duplicated for a logged-in buyer even if they type a different phone than the one
  // already linked to their account, and a guest row matching this buyer's phone gets linked
  // (not duplicated) the first time they happen to check out while logged in. See DECISIONS.md's
  // Buyer Accounts ADR for the exact rule.
  private async upsertCustomer(tx: Prisma.TransactionClient, dto: CustomerInfoDto, buyerUserId?: string) {
    if (buyerUserId) {
      const linked = await tx.customer.findFirst({ where: { userId: buyerUserId } });
      if (linked) {
        return tx.customer.update({ where: { id: linked.id }, data: { fullName: dto.fullName, email: dto.email ?? linked.email } });
      }
      const guestMatch = await tx.customer.findFirst({ where: { phone: dto.phone, userId: null }, orderBy: { createdAt: "desc" } });
      if (guestMatch) {
        return tx.customer.update({
          where: { id: guestMatch.id },
          data: { fullName: dto.fullName, email: dto.email ?? guestMatch.email, userId: buyerUserId },
        });
      }
      return tx.customer.create({ data: { fullName: dto.fullName, phone: dto.phone, email: dto.email, userId: buyerUserId } });
    }

    const existing = await tx.customer.findFirst({ where: { phone: dto.phone }, orderBy: { createdAt: "desc" } });
    if (existing) {
      return tx.customer.update({ where: { id: existing.id }, data: { fullName: dto.fullName, email: dto.email ?? existing.email } });
    }
    return tx.customer.create({ data: { fullName: dto.fullName, phone: dto.phone, email: dto.email } });
  }

  // ---- Checkout / creation (public) ----

  async createOrder(offerSlug: string, dto: CreateCheckoutDto, buyerUserId?: string): Promise<PublicOrderResponse & { orderId: string; paymentProvider: PaymentProviderType; paymentId: string | null }> {
    const existingByKey = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: ORDER_INCLUDE });
    if (existingByKey) {
      return { ...this.toPublicResponse(existingByKey), orderId: existingByKey.id, paymentProvider: existingByKey.payment?.provider ?? "CLICK", paymentId: existingByKey.payment?.id ?? null };
    }

    const offer = await this.prisma.offer.findUnique({
      where: { slug: offerSlug },
      include: { product: true, landingPage: true, variants: true },
    });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    if (this.offers.computeAvailability(offer) !== "LIVE") {
      throw new DomainException("OFFER_INACTIVE", "Ushbu taklif hozircha faol emas.");
    }
    if (offer.product.status === "ARCHIVED") {
      throw new DomainException("PRODUCT_ARCHIVED", "Ushbu mahsulot arxivlangan.");
    }
    if (!offer.landingPage || offer.landingPage.status !== "PUBLISHED" || offer.landingPage.archivedAt) {
      throw new DomainException("OFFER_INACTIVE", "Ushbu taklif uchun landing sahifa faol emas.");
    }

    const variant = dto.variantId ? offer.variants.find((v) => v.id === dto.variantId) : (offer.variants.find((v) => v.isDefault) ?? offer.variants[0]);
    if (dto.variantId && !variant) throw new DomainException("VALIDATION_ERROR", "Noto'g'ri variant tanlandi.", { field: "variantId" });
    const unitPriceMinor = variant?.priceMinor ?? offer.priceMinor;
    const variantName = variant?.name ?? null;
    const quantity = 1; // spec: "support order items even if currently one item only"

    if (offer.product.type === "PHYSICAL_PRODUCT" && offer.product.stockQuantity != null && offer.product.stockQuantity < quantity) {
      throw new DomainException("OUT_OF_STOCK", "Ushbu mahsulot omborda mavjud emas.");
    }

    this.assertCustomerInfoValid(dto.customer, offer.product.type);
    const provider = this.resolvePaymentProvider(dto.paymentMethod, offer.paymentOptions);

    const fee = await this.delivery.resolveDeliveryFee(offer.id, offer.product.type, dto.regionCode);
    const subtotalMinor = unitPriceMinor * quantity;
    const attribution = await this.resolveAttribution(offer.id, dto.refCode, dto.promoCode, dto.visitorId);

    const order = await this.prisma.$transaction(async (tx) => {
      const customer = await this.upsertCustomer(tx, dto.customer, buyerUserId);

      let address = null;
      if (dto.customer.region || dto.customer.address) {
        address = await tx.address.create({
          data: {
            customerId: customer.id,
            region: dto.customer.region ?? "",
            city: dto.customer.region ?? "",
            district: dto.customer.district,
            line1: dto.customer.address ?? "",
            comment: dto.customer.notes,
          },
        });
      }

      let discountMinor = 0;
      let promoCodeId: string | null = null;
      if (dto.promoCode) {
        const redemption = await this.promoCodes.findAndAssertUsable(tx, offer.id, dto.promoCode, subtotalMinor, customer.id);
        discountMinor = redemption.discountMinor;
        promoCodeId = redemption.promo.id;
      }

      const totalMinor = Math.max(subtotalMinor - discountMinor + fee.deliveryFeeMinor, 0);

      const offerSnapshot = {
        offerId: offer.id,
        offerName: offer.name,
        variantId: variant?.id ?? null,
        variantName,
        unitPriceMinor,
        currency: offer.currency,
        productType: offer.product.type,
      };

      const created = await tx.order.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          type: mapProductTypeToOrderType(offer.product.type),
          offerId: offer.id,
          campaignId: attribution?.campaignId ?? null,
          customerId: customer.id,
          addressId: address?.id ?? null,
          promoCodeId,
          status: "CREATED",
          offerSnapshot,
          subtotalMinor,
          discountMinor,
          shippingMinor: fee.deliveryFeeMinor,
          totalMinor,
          currency: offer.currency,
          deliveryMethod: dto.deliveryMethod,
          secondPhone: dto.customer.secondPhone,
          notes: dto.customer.notes,
          flowId: attribution?.source === "FLOW" ? attribution.flowId : null,
          referralCode: attribution?.source === "FLOW" ? dto.refCode : null,
          productId: attribution?.source === "FLOW" ? attribution.productId : null,
        },
      });

      await tx.orderItem.create({
        data: { orderId: created.id, variantId: variant?.id, nameSnapshot: variantName ?? offer.name, quantity, unitPriceMinor, totalMinor: unitPriceMinor * quantity },
      });

      await tx.orderStatusHistory.create({ data: { orderId: created.id, fromStatus: null, toStatus: "CREATED" } });

      if (promoCodeId) await this.promoCodes.commitUsage(tx, promoCodeId, created.id, customer.id);

      if (attribution) {
        await tx.attribution.create({
          data: {
            orderId: created.id,
            creatorId: attribution.creatorId,
            campaignId: attribution.campaignId,
            offerId: attribution.source === "FLOW" ? null : offer.id,
            source: attribution.source,
            referralVisitId: attribution.referralVisitId,
            promoCodeId: attribution.source === "PROMO_CODE" ? promoCodeId : null,
          },
        });

        // Handle commission based on attribution type
        if (attribution.source === "FLOW" && attribution.productId) {
          // Flow-based attribution: use Product commission settings
          const product = await tx.product.findUnique({
            where: { id: attribution.productId },
            select: { id: true, commissionType: true, commissionRateBps: true, commissionAmountMinor: true },
          });
          if (product) {
            const baseAmountMinor = subtotalMinor - discountMinor;
            let amountMinor = 0;
            if (product.commissionType === "PERCENTAGE") {
              amountMinor = applyBasisPoints(baseAmountMinor, product.commissionRateBps ?? 0);
            } else if (product.commissionType === "FIXED_AMOUNT") {
              amountMinor = product.commissionAmountMinor ?? 0;
            }
            // Create commission without commissionRule for Flow-based
            await tx.commission.create({
              data: {
                orderId: created.id,
                creatorId: attribution.creatorId,
                commissionRuleId: null, // No commissionRule for Flow-based
                baseAmountMinor,
                amountMinor,
                currency: offer.currency,
                status: "PENDING"
              },
            });

            if (attribution.flowId) {
              await tx.flow.update({
                where: { id: attribution.flowId },
                data: { orderCount: { increment: 1 }, commissionEarnedMinor: { increment: amountMinor } },
              });
            }
          }
        } else if (attribution.campaignId) {
          // Campaign-based attribution: use Campaign commission settings
          const campaign = await tx.campaign.findUnique({
            where: { id: attribution.campaignId },
            select: { id: true, commissionType: true, commissionRateBps: true, commissionAmountMinor: true },
          });
          if (campaign) {
            const rule = await this.getOrCreateCurrentCommissionRule(tx, campaign);
            const baseAmountMinor = subtotalMinor - discountMinor;
            const amountMinor = rule.commissionType === "PERCENTAGE" ? applyBasisPoints(baseAmountMinor, rule.commissionRateBps ?? 0) : (rule.commissionAmountMinor ?? 0);
            await tx.commission.create({
              data: { orderId: created.id, creatorId: attribution.creatorId, commissionRuleId: rule.id, baseAmountMinor, amountMinor, currency: offer.currency, status: "PENDING" },
            });
          }
        }
      }

      return created;
    });

    await this.audit.record({ actorId: null, action: "CHECKOUT_CREATED", entityType: "Order", entityId: order.id, after: { status: "CREATED", totalMinor: order.totalMinor, provider } });

    const full = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
    return { ...this.toPublicResponse(full), orderId: order.id, paymentProvider: provider, paymentId: null };
  }

  // Order-success page lookup — the payment redirect URL was already handed to the buyer once, at
  // checkout submission time (see PublicCheckoutController.checkout); reloading this page never
  // re-issues a new one, it just reports the current status.
  async findByPublicToken(publicToken: string): Promise<PublicOrderResponse> {
    const order = await this.prisma.order.findUnique({ where: { publicToken }, include: ORDER_INCLUDE });
    if (!order) throw new DomainException("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
    return this.toPublicResponse(order);
  }

  // ---- Lifecycle (called by PaymentsService after a verified callback) ----

  private async findRawOrThrow(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new DomainException("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
    return order;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!TRANSITIONS[from].includes(to)) {
      throw new DomainException("INVALID_ORDER_TRANSITION", "Bu holatlar orasida o'tish mumkin emas.", { from, to });
    }
  }

  async transitionStatus(id: string, to: OrderStatus, actorId: string | null, note?: string): Promise<Order> {
    const existing = await this.findRawOrThrow(id);
    this.assertTransition(existing.status, to);
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({ where: { id }, data: { status: to } });
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: existing.status, toStatus: to, changedById: actorId ?? undefined, note } });
      return order;
    });
    await this.audit.record({ actorId, action: "STATUS_UPDATED", entityType: "Order", entityId: id, before: { status: existing.status }, after: { status: to } });
    return updated;
  }

  // Called by PaymentsService once a Payment for this Order is verified PAID, AND by
  // adminUpdateStatus when an admin manually approves a Pay Later order (see DECISIONS.md
  // ADR-015 point 6) — both are "this order got paid" events and must trigger the exact same
  // consequences. Owns every one of them in one place: status transition, stock reservation, and
  // the referral qualified-sale hook — so callers never have to know what paying for an order means.
  // `providerReference` (Phase 14): PaymentsService.handleClickCallback used to update
  // Payment.status/providerReference in its own, separate, un-transacted write before calling
  // this method — a real crash-window gap (a process death between that write and this one's own
  // transaction could leave Payment showing PAID while Order stayed PAYMENT_PENDING). Accepting
  // the provider reference here and setting it inside this method's own transaction closes that
  // window: Order status, stock, and Payment now commit atomically or not at all.
  async markPaid(orderId: string, actorId: string | null = null, note?: string, providerReference?: string): Promise<void> {
    const order = await this.findRawOrThrow(orderId);
    if (order.status === "PAID") return; // already processed — replayed callback, no-op
    this.assertTransition(order.status, "PAID");

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: "PAID", changedById: actorId ?? undefined, note } });
      await this.reserveStock(tx, orderId);
      // Keeps Payment.status in sync for the admin-manual-approval path (Pay Later): the Click
      // callback path passes providerReference through to be set here in the same transaction, so
      // this is a harmless no-op there; for a MANUAL Payment it's the only place that ever marks
      // it PAID.
      await tx.payment.updateMany({ where: { orderId, status: { not: "PAID" } }, data: { status: "PAID", ...(providerReference ? { providerReference } : {}) } });
    });
    await this.audit.record({ actorId, action: "PAYMENT_SUCCESS", entityType: "Order", entityId: orderId, after: { status: "PAID", note } });

    const attribution = await this.prisma.attribution.findUnique({ where: { orderId } });
    if (attribution) await this.referrals.onQualifiedSale(attribution.creatorId, orderId);
  }

  // `providerReference` (Phase 14): same atomicity fix as markPaid above — Payment.status=FAILED
  // and the Order's CANCELLED transition now commit inside one transaction instead of two
  // separate un-transacted writes from PaymentsService.
  async markPaymentFailed(orderId: string, reason: string, providerReference?: string): Promise<void> {
    const order = await this.findRawOrThrow(orderId);
    if (order.status !== "PAYMENT_PENDING" && order.status !== "CREATED") return; // already resolved
    const note = `To'lov muvaffaqiyatsiz: ${reason}`;
    this.assertTransition(order.status, "CANCELLED");
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: "CANCELLED", note } });
      await tx.payment.updateMany({ where: { orderId, status: { not: "FAILED" } }, data: { status: "FAILED", ...(providerReference ? { providerReference } : {}) } });
    });
    await this.audit.record({ actorId: null, action: "STATUS_UPDATED", entityType: "Order", entityId: orderId, before: { status: order.status }, after: { status: "CANCELLED" } });
    await this.audit.record({ actorId: null, action: "PAYMENT_FAILED", entityType: "Order", entityId: orderId, after: { reason } });
  }

  // Atomic decrement guarded by the Product_stock_non_negative_check DB constraint (see migration
  // 20260724000000_checkout_payment_order) — the real concurrency guard against overselling. This
  // app-level check is the fast/common-case path; the constraint is what actually prevents two
  // concurrent PAID transitions from both succeeding when only one unit is left.
  private async reserveStock(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId }, include: { order: { select: { offerId: true } } } });
    for (const item of items) {
      if (!item.order.offerId) continue;
      const offer = await tx.offer.findUnique({ where: { id: item.order.offerId }, select: { productId: true } });
      if (!offer) continue;
      const product = await tx.product.findUnique({ where: { id: offer.productId }, select: { type: true, stockQuantity: true } });
      if (!product || product.type !== "PHYSICAL_PRODUCT" || product.stockQuantity == null) continue;
      if (product.stockQuantity < item.quantity) {
        throw new DomainException("OUT_OF_STOCK", "Ushbu mahsulot omborda yetarli emas.");
      }
      await tx.product.update({ where: { id: offer.productId }, data: { stockQuantity: { decrement: item.quantity } } });
    }
  }

  private async releaseStock(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId }, include: { order: { select: { offerId: true } } } });
    for (const item of items) {
      if (!item.order.offerId) continue;
      const offer = await tx.offer.findUnique({ where: { id: item.order.offerId }, select: { productId: true } });
      if (!offer) continue;
      const product = await tx.product.findUnique({ where: { id: offer.productId }, select: { type: true, stockQuantity: true } });
      if (!product || product.type !== "PHYSICAL_PRODUCT" || product.stockQuantity == null) continue;
      await tx.product.update({ where: { id: offer.productId }, data: { stockQuantity: { increment: item.quantity } } });
    }
  }

  // ---- Admin ----

  async list(query: OrderQueryDto): Promise<PaginatedResult<AdminOrderResponse>> {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      campaignId: query.campaignId,
      attribution: query.creatorId ? { creatorId: query.creatorId } : undefined,
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { customer: { fullName: { contains: query.search, mode: "insensitive" } } },
              { customer: { phone: { contains: query.search, mode: "insensitive" } } },
              { offer: { name: { contains: query.search, mode: "insensitive" } } },
              { publicToken: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "totalMinor", "status"]);
    const orderBy: Prisma.OrderOrderByWithRelationInput = query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy, skip: query.skip, take: query.take, include: ORDER_INCLUDE }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items.map((o) => this.toAdminResponse(o)), total, query);
  }

  async findOneOrThrow(id: string): Promise<AdminOrderResponse> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new DomainException("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
    return this.toAdminResponse(order);
  }

  async adminUpdateStatus(id: string, to: OrderStatus, actorId: string, note: string | undefined): Promise<AdminOrderResponse> {
    // REFUNDED must always go through createRefund — that's the only path that creates the
    // Refund record and releases stock. A bare status flip here would leave an order marked
    // REFUNDED with no Refund row and stock still reserved.
    if (to === "REFUNDED") {
      throw new DomainException("VALIDATION_ERROR", "Qaytarish uchun 'Refund yaratish' funksiyasidan foydalaning.", { field: "status" });
    }
    // PAID must always go through markPaid — the same "an order became PAID" side effects (stock
    // reservation, referral qualified-sale hook) apply whether a real Click callback confirmed it
    // or an admin manually approved a Pay Later order (see DECISIONS.md ADR-015 point 6). A bare
    // status flip here would silently skip both.
    if (to === "PAID") {
      await this.markPaid(id, actorId, note);
      return this.findOneOrThrow(id);
    }
    const existing = await this.findRawOrThrow(id);
    if (to === "CANCELLED" && ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(existing.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.releaseStock(tx, id);
      });
    }
    await this.transitionStatus(id, to, actorId, note);
    if (to === "CANCELLED") await this.audit.record({ actorId, action: "ORDER_CANCELLED", entityType: "Order", entityId: id, after: { note } });
    return this.findOneOrThrow(id);
  }

  async updateNotes(id: string, notes: string, actorId: string): Promise<AdminOrderResponse> {
    await this.findRawOrThrow(id);
    await this.prisma.order.update({ where: { id }, data: { notes } });
    await this.audit.record({ actorId, action: "NOTES_UPDATED", entityType: "Order", entityId: id, after: { notes } });
    return this.findOneOrThrow(id);
  }

  async createRefund(id: string, dto: CreateRefundDto, actorId: string): Promise<AdminOrderResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(existing.status)) {
      throw new DomainException("REFUND_NOT_ELIGIBLE", "Bu holatdagi buyurtmani qaytarib bo'lmaydi.", { status: existing.status });
    }
    if (dto.amountMinor > existing.totalMinor) {
      throw new DomainException("VALIDATION_ERROR", "Qaytarish summasi buyurtma summasidan katta bo'lishi mumkin emas.", { field: "amountMinor" });
    }
    await this.prisma.refund.create({ data: { orderId: id, amountMinor: dto.amountMinor, reason: dto.reason, requestedById: actorId, status: "REQUESTED" } });
    await this.audit.record({ actorId, action: "REFUND_REQUESTED", entityType: "Order", entityId: id, after: { amountMinor: dto.amountMinor, reason: dto.reason } });
    if (dto.amountMinor === existing.totalMinor) {
      await this.prisma.$transaction(async (tx) => this.releaseStock(tx, id));
      await this.transitionStatus(id, "REFUNDED", actorId, "To'liq qaytarish.");
    }
    return this.findOneOrThrow(id);
  }
}
