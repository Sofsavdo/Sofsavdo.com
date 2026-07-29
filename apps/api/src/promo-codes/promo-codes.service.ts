import { Injectable } from "@nestjs/common";
import type { Prisma, PromoCode } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { applyBasisPoints } from "../common/money/money";

export interface PromoCodeValidationResponse {
  code: string;
  discountType: PromoCode["discountType"];
  discountValue: number;
  discountMinor: number;
}

// The `/admin/promo-codes` page's real backend — previously a bare mock re-export with zero
// USE_REAL_API gating at all (see DECISIONS.md ADR-031). `usageCount` is already maintained
// directly on the row by redeem() below, so this needs no separate aggregation query.
export interface AdminPromoCodeResponse {
  code: string;
  creatorName: string;
  campaignName: string;
  discountType: PromoCode["discountType"];
  discountValue: number;
  usageCount: number;
  usageLimit: number | null;
  isActive: boolean;
}

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  async listAdmin(): Promise<AdminPromoCodeResponse[]> {
    const rows = await this.prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { displayName: true } }, campaign: { select: { name: true } } },
    });
    return rows.map((p) => ({
      code: p.code,
      creatorName: p.creator.displayName,
      campaignName: p.campaign.name,
      discountType: p.discountType,
      discountValue: p.discountValue,
      usageCount: p.usageCount,
      usageLimit: p.usageLimit,
      isActive: p.isActive,
    }));
  }

  private computeDiscountMinor(promo: Pick<PromoCode, "discountType" | "discountValue">, baseAmountMinor: number): number {
    if (promo.discountType === "PERCENTAGE") return applyBasisPoints(baseAmountMinor, promo.discountValue);
    return Math.min(promo.discountValue, baseAmountMinor);
  }

  // Shared assertion chain — used by both the read-only preview (validate) and the authoritative
  // redemption at order-creation time (redeem). customerId is only checked when provided: at
  // preview time no Customer exists yet (spec's checkout form hasn't been filled in), so the
  // per-customer usage limit can only be enforced for real at redemption, where redeem() passes it.
  private async assertUsable(
    client: Prisma.TransactionClient | PrismaService,
    promo: PromoCode,
    offerId: string,
    baseAmountMinor: number,
    customerId: string | undefined,
    now: Date,
  ): Promise<void> {
    if (promo.offerId !== offerId) throw new DomainException("PROMO_NOT_FOUND", "Promo kod topilmadi.");
    if (!promo.isActive) throw new DomainException("PROMO_INACTIVE", "Promo kod faol emas.");
    if (promo.startsAt > now) throw new DomainException("PROMO_NOT_STARTED", "Promo kod hali boshlanmagan.");
    if (promo.expiresAt && promo.expiresAt < now) throw new DomainException("PROMO_EXPIRED", "Promo kod muddati tugagan.");
    if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) {
      throw new DomainException("PROMO_USAGE_LIMIT", "Promo kod ishlatilish limiti tugagan.");
    }
    if (promo.minimumOrderAmount != null && baseAmountMinor < promo.minimumOrderAmount) {
      throw new DomainException("PROMO_MINIMUM_NOT_REACHED", "Buyurtma summasi promo kod uchun yetarli emas.", {
        minimumOrderAmount: promo.minimumOrderAmount,
      });
    }
    if (customerId && promo.perCustomerLimit != null) {
      const usedByCustomer = await client.promoCodeUsage.count({ where: { promoCodeId: promo.id, customerId } });
      if (usedByCustomer >= promo.perCustomerLimit) {
        throw new DomainException("PROMO_CUSTOMER_LIMIT", "Ushbu mijoz uchun promo kod limiti tugagan.");
      }
    }
  }

  private async findByCodeOrThrow(code: string): Promise<PromoCode> {
    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!promo) throw new DomainException("PROMO_NOT_FOUND", "Promo kod topilmadi.");
    return promo;
  }

  // Read-only preview — never mutates usageCount, never creates a PromoCodeUsage row. Backs the
  // public "Qo'llash" button at checkout, mirroring DeliveryService.quote()'s "never creates an
  // Order" convention.
  async validate(offerSlug: string, code: string, baseAmountMinor: number): Promise<PromoCodeValidationResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { slug: offerSlug }, select: { id: true } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    const promo = await this.findByCodeOrThrow(code);
    await this.assertUsable(this.prisma, promo, offer.id, baseAmountMinor, undefined, new Date());
    return {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountMinor: this.computeDiscountMinor(promo, baseAmountMinor),
    };
  }

  // Step 1 of authoritative redemption — called inside the Order-creation transaction, before the
  // Order row exists (its id is needed by commitUsage below, which is why this is split from it).
  // Re-validates everything from scratch (never trusts the frontend's earlier validate() call as
  // proof of eligibility).
  async findAndAssertUsable(
    tx: Prisma.TransactionClient,
    offerId: string,
    code: string,
    baseAmountMinor: number,
    customerId: string,
  ): Promise<{ promo: PromoCode; discountMinor: number }> {
    const promo = await tx.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!promo) throw new DomainException("PROMO_NOT_FOUND", "Promo kod topilmadi.");
    await this.assertUsable(tx, promo, offerId, baseAmountMinor, customerId, new Date());
    return { promo, discountMinor: this.computeDiscountMinor(promo, baseAmountMinor) };
  }

  // Step 2 — called after the Order row is created, inside the same transaction. Increment +
  // usage-row creation happen together so a concurrent redemption of the same code can't
  // double-spend a usage slot (both writes serialize against any other transaction touching the
  // same PromoCode row).
  async commitUsage(tx: Prisma.TransactionClient, promoCodeId: string, orderId: string, customerId: string): Promise<void> {
    await tx.promoCode.update({ where: { id: promoCodeId }, data: { usageCount: { increment: 1 } } });
    await tx.promoCodeUsage.create({ data: { promoCodeId, orderId, customerId } });
  }
}
