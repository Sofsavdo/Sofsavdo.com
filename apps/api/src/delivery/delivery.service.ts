import { Injectable } from "@nestjs/common";
import type { OfferDeliveryRegion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import type { CreateDeliveryRegionDto } from "./dto/create-delivery-region.dto";
import type { UpdateDeliveryRegionDto } from "./dto/update-delivery-region.dto";

// Regional delivery pricing (6B Enhancement) — owned by Offer, not Product, because different
// Offers for the same Product may run different delivery promotions (spec-confirmed ownership;
// see DECISIONS.md ADR-013). Only Offers whose Product.type is PHYSICAL_PRODUCT may have rows.
export type DeliveryRegionAdminResponse = OfferDeliveryRegion;

// Public/customer-safe shape — every field here is meant to be shown to a buyer; there's no
// admin-only metadata on this model, but a dedicated type still exists so the public quote
// endpoint's contract doesn't accidentally start leaking a future admin-only field added to the
// Prisma model without a deliberate decision to expose it.
export interface DeliveryRegionPublicResponse {
  regionCode: string;
  regionName: string;
  feeType: string;
  deliveryFeeMinor: number;
  currency: string;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
}

export interface OfferQuoteResponse {
  priceMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: string;
  regionRequired: boolean;
  regionCode: string | null;
  regionName: string | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
}

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  private toPublicResponse(r: OfferDeliveryRegion): DeliveryRegionPublicResponse {
    return {
      regionCode: r.regionCode,
      regionName: r.regionName,
      feeType: r.feeType,
      deliveryFeeMinor: r.deliveryFeeMinor,
      currency: r.currency,
      estimatedMinDays: r.estimatedMinDays,
      estimatedMaxDays: r.estimatedMaxDays,
    };
  }

  private async assertOfferIsPhysical(offerId: string): Promise<{ id: string; priceMinor: number; currency: string; slug: string }> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId }, include: { product: { select: { type: true } } } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    if (offer.product.type !== "PHYSICAL_PRODUCT") {
      throw new DomainException("PRODUCT_NOT_PHYSICAL", "Yetkazib berish qoidalari faqat jismoniy mahsulot Offerlariga tegishli.");
    }
    return { id: offer.id, priceMinor: offer.priceMinor, currency: offer.currency, slug: offer.slug };
  }

  private assertFeeAndDaysValid(dto: { feeType: string; deliveryFeeMinor?: number; estimatedMinDays?: number; estimatedMaxDays?: number }): void {
    if (dto.feeType === "FREE" && dto.deliveryFeeMinor != null && dto.deliveryFeeMinor !== 0) {
      throw new DomainException("VALIDATION_ERROR", "FREE turi uchun yetkazib berish narxi 0 bo'lishi kerak.", { field: "deliveryFeeMinor" });
    }
    if (dto.feeType === "FIXED" && (dto.deliveryFeeMinor == null || dto.deliveryFeeMinor <= 0)) {
      throw new DomainException("VALIDATION_ERROR", "FIXED turi uchun yetkazib berish narxi musbat bo'lishi kerak.", { field: "deliveryFeeMinor" });
    }
    if (dto.estimatedMinDays != null && dto.estimatedMaxDays != null && dto.estimatedMinDays > dto.estimatedMaxDays) {
      throw new DomainException("VALIDATION_ERROR", "Minimal yetkazib berish muddati maksimaldan katta bo'lishi mumkin emas.", {
        field: "estimatedMinDays",
      });
    }
  }

  // ---- Admin ----

  async listForAdmin(offerId: string): Promise<DeliveryRegionAdminResponse[]> {
    await this.assertOfferIsPhysical(offerId);
    return this.prisma.offerDeliveryRegion.findMany({ where: { offerId }, orderBy: { sortOrder: "asc" } });
  }

  async create(offerId: string, dto: CreateDeliveryRegionDto): Promise<DeliveryRegionAdminResponse> {
    await this.assertOfferIsPhysical(offerId);
    this.assertFeeAndDaysValid(dto);

    const existing = await this.prisma.offerDeliveryRegion.findUnique({
      where: { offerId_regionCode: { offerId, regionCode: dto.regionCode } },
    });
    if (existing) throw new DomainException("CONFLICT", "Bu Offer uchun ushbu region allaqachon mavjud.", { field: "regionCode" });

    const last = await this.prisma.offerDeliveryRegion.findFirst({ where: { offerId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

    return this.prisma.offerDeliveryRegion.create({
      data: {
        offerId,
        countryCode: dto.countryCode ?? "UZ",
        regionCode: dto.regionCode,
        regionName: dto.regionName,
        availability: dto.availability ?? "AVAILABLE",
        feeType: dto.feeType,
        deliveryFeeMinor: dto.feeType === "FREE" ? 0 : (dto.deliveryFeeMinor ?? 0),
        currency: dto.currency ?? "UZS",
        estimatedMinDays: dto.estimatedMinDays,
        estimatedMaxDays: dto.estimatedMaxDays,
        active: dto.active ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(id: string, dto: UpdateDeliveryRegionDto): Promise<DeliveryRegionAdminResponse> {
    const existing = await this.prisma.offerDeliveryRegion.findUnique({ where: { id } });
    if (!existing) throw new DomainException("DELIVERY_REGION_NOT_FOUND", "Yetkazib berish regioni topilmadi.");

    const nextFeeType = dto.feeType ?? existing.feeType;
    const nextFeeMinor = dto.deliveryFeeMinor !== undefined ? dto.deliveryFeeMinor : existing.deliveryFeeMinor;
    const nextMinDays = dto.estimatedMinDays !== undefined ? dto.estimatedMinDays : existing.estimatedMinDays;
    const nextMaxDays = dto.estimatedMaxDays !== undefined ? dto.estimatedMaxDays : existing.estimatedMaxDays;
    this.assertFeeAndDaysValid({
      feeType: nextFeeType,
      deliveryFeeMinor: nextFeeMinor ?? undefined,
      estimatedMinDays: nextMinDays ?? undefined,
      estimatedMaxDays: nextMaxDays ?? undefined,
    });

    if (dto.regionCode && dto.regionCode !== existing.regionCode) {
      const clash = await this.prisma.offerDeliveryRegion.findUnique({
        where: { offerId_regionCode: { offerId: existing.offerId, regionCode: dto.regionCode } },
      });
      if (clash) throw new DomainException("CONFLICT", "Bu Offer uchun ushbu region allaqachon mavjud.", { field: "regionCode" });
    }

    return this.prisma.offerDeliveryRegion.update({
      where: { id },
      data: {
        countryCode: dto.countryCode,
        regionCode: dto.regionCode,
        regionName: dto.regionName,
        availability: dto.availability,
        feeType: dto.feeType,
        deliveryFeeMinor: nextFeeType === "FREE" ? 0 : nextFeeMinor,
        currency: dto.currency,
        estimatedMinDays: dto.estimatedMinDays,
        estimatedMaxDays: dto.estimatedMaxDays,
        active: dto.active,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.offerDeliveryRegion.findUnique({ where: { id } });
    if (!existing) throw new DomainException("DELIVERY_REGION_NOT_FOUND", "Yetkazib berish regioni topilmadi.");
    await this.prisma.offerDeliveryRegion.delete({ where: { id } });
  }

  // ---- Public ----

  // Used by LandingsService to populate the region selector on a PHYSICAL_PRODUCT offer's public
  // landing page — active + AVAILABLE regions only; deterministic sortOrder.
  async listActiveRegionsForOffer(offerId: string): Promise<DeliveryRegionPublicResponse[]> {
    const rows = await this.prisma.offerDeliveryRegion.findMany({
      where: { offerId, active: true, availability: "AVAILABLE" },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toPublicResponse(r));
  }

  // Region-fee resolution shared by the public quote() below and CheckoutService (Phase 8) — the
  // one place delivery-fee logic lives, so checkout never recomputes it independently (spec:
  // "reuse existing Delivery domain; delivery fee must come from backend; do not duplicate
  // delivery logic"). Non-physical products never require a region and never carry a fee.
  async resolveDeliveryFee(
    offerId: string,
    productType: string,
    regionCode: string | undefined,
  ): Promise<{ deliveryFeeMinor: number; regionRequired: boolean; regionCode: string | null; regionName: string | null; estimatedMinDays: number | null; estimatedMaxDays: number | null }> {
    if (productType !== "PHYSICAL_PRODUCT") {
      return { deliveryFeeMinor: 0, regionRequired: false, regionCode: null, regionName: null, estimatedMinDays: null, estimatedMaxDays: null };
    }

    if (!regionCode) throw new DomainException("REGION_REQUIRED", "Jismoniy mahsulot uchun yetkazib berish regioni tanlanishi shart.");

    const region = await this.prisma.offerDeliveryRegion.findUnique({ where: { offerId_regionCode: { offerId, regionCode } } });
    if (!region || !region.active) throw new DomainException("DELIVERY_REGION_NOT_FOUND", "Tanlangan region topilmadi.");
    if (region.availability !== "AVAILABLE") {
      throw new DomainException("DELIVERY_REGION_UNAVAILABLE", "Tanlangan regionga hozircha yetkazib berish mavjud emas.");
    }

    return {
      deliveryFeeMinor: region.deliveryFeeMinor,
      regionRequired: true,
      regionCode: region.regionCode,
      regionName: region.regionName,
      estimatedMinDays: region.estimatedMinDays,
      estimatedMaxDays: region.estimatedMaxDays,
    };
  }

  // Authoritative price computation — the frontend never computes this itself (see spec
  // "Frontend arithmetic must not be the source of truth"). Never creates an Order; read-only.
  async quote(offerSlug: string, regionCode: string | undefined): Promise<OfferQuoteResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { slug: offerSlug }, include: { product: { select: { type: true } } } });
    if (!offer || offer.status === "ARCHIVED") throw new DomainException("NOT_FOUND", "Offer topilmadi.");

    const fee = await this.resolveDeliveryFee(offer.id, offer.product.type, regionCode);
    return {
      priceMinor: offer.priceMinor,
      deliveryFeeMinor: fee.deliveryFeeMinor,
      totalMinor: offer.priceMinor + fee.deliveryFeeMinor,
      currency: offer.currency,
      regionRequired: fee.regionRequired,
      regionCode: fee.regionCode,
      regionName: fee.regionName,
      estimatedMinDays: fee.estimatedMinDays,
      estimatedMaxDays: fee.estimatedMaxDays,
    };
  }
}
