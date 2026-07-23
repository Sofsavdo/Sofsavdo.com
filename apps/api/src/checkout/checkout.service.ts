import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService, type PublicOrderResponse } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { PromoCodesService, type PromoCodeValidationResponse } from "../promo-codes/promo-codes.service";
import { DomainException } from "../common/errors/domain-error";
import type { CreateCheckoutDto } from "../orders/dto/create-checkout.dto";
import type { TrackVisitDto } from "./dto/track-visit.dto";
import type { ValidatePromoDto } from "./dto/validate-promo.dto";

export interface TrackVisitResponse {
  visitorId: string;
  creatorDisplayName: string | null;
  promoCode: string | null;
}

// Thin orchestrator — the one place that needs both OrdersService and PaymentsService in the same
// call (create the Order, then start the Payment for it). Everything else here is a direct
// passthrough to the service that actually owns the logic; this class holds no business rules of
// its own beyond that hand-off.
@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private payments: PaymentsService,
    private promoCodes: PromoCodesService,
  ) {}

  // Records a ReferralVisit (previously entirely unbuilt — see DECISIONS.md ADR-015) so a later
  // checkout can attribute the sale even if the buyer doesn't return with the ?ref= link still in
  // the URL. Never blocks on an unknown/expired code — an invalid ref just means "no attribution
  // signal", not a rejected page view.
  async trackVisit(offerSlug: string, dto: TrackVisitDto, ipHash: string, userAgent: string | undefined): Promise<TrackVisitResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { slug: offerSlug }, select: { id: true } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");

    const visitorId = randomUUID();
    if (!dto.refCode) return { visitorId, creatorDisplayName: null, promoCode: null };

    const link = await this.prisma.referralLink.findUnique({
      where: { code: dto.refCode },
      include: { creator: { select: { displayName: true } }, promoCode: { select: { code: true } } },
    });
    if (!link || link.offerId !== offer.id || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt < new Date())) {
      return { visitorId, creatorDisplayName: null, promoCode: null };
    }

    await this.prisma.referralVisit.create({
      data: {
        referralLinkId: link.id,
        creatorId: link.creatorId,
        campaignId: link.campaignId,
        offerId: offer.id,
        visitorId,
        sessionId: randomUUID(),
        landingPage: `/o/${offerSlug}`,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        ipHash,
        userAgent,
        referrer: dto.referrer,
        expiresAt: new Date(Date.now() + link.attributionWindowDays * 24 * 60 * 60 * 1000),
      },
    });

    return { visitorId, creatorDisplayName: link.creator.displayName, promoCode: link.promoCode?.code ?? null };
  }

  validatePromo(offerSlug: string, dto: ValidatePromoDto): Promise<PromoCodeValidationResponse> {
    return this.promoCodes.validate(offerSlug, dto.code, dto.baseAmountMinor);
  }

  async checkout(offerSlug: string, dto: CreateCheckoutDto): Promise<PublicOrderResponse> {
    const created = await this.orders.createOrder(offerSlug, dto);
    const { redirectUrl } = await this.payments.initiatePayment(created.orderId, created.paymentProvider);
    // Re-fetch rather than trust `created`'s embedded status — that snapshot was taken before
    // initiatePayment() transitioned CREATED -> PAYMENT_PENDING, so it's already stale by now.
    const current = await this.orders.findByPublicToken(created.publicToken);
    return { ...current, paymentRedirectUrl: redirectUrl };
  }

  getOrder(publicToken: string): Promise<PublicOrderResponse> {
    return this.orders.findByPublicToken(publicToken);
  }
}
