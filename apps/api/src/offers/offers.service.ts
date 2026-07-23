import { Injectable } from "@nestjs/common";
import type { Offer, OfferStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { impliedDiscountBasisPoints } from "../common/money/money";
import type { CreateOfferDto } from "./dto/create-offer.dto";
import type { UpdateOfferDto } from "./dto/update-offer.dto";
import type { OfferQueryDto } from "./dto/offer-query.dto";

export type Availability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";

const PRODUCT_SUMMARY_SELECT = { id: true, name: true, slug: true, sku: true, status: true } satisfies Prisma.ProductSelect;

type OfferWithProduct = Offer & {
  product: { id: string; name: string; slug: string; sku: string | null; status: string };
  variants: { id: string; name: string; priceMinor: number; isDefault: boolean; sortOrder: number }[];
};

export interface OfferResponse extends OfferWithProduct {
  availability: Availability;
  impliedDiscountBasisPoints: number;
}

// Explicit transition matrix — the only source of truth for "is X -> Y allowed". No endpoint sets
// `status` directly; activate()/pause()/archive() each check this before writing anything.
// ARCHIVED has no outgoing edges at all: archiving is one-way, per spec ("an archived Offer
// cannot be activated").
const ALLOWED_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  // Stored `status` vs. computed `availability` are deliberately different concepts (see the
  // schema comment on OfferStatus): an ACTIVE offer whose expiresAt has passed is still stored as
  // ACTIVE (an admin action, or a scheduled job in a later phase, is what should eventually pause
  // it) but must never be reported as buyable. This function is the one place that reconciles the
  // two for API responses; nothing else in this module reads startsAt/expiresAt to decide
  // buyability.
  computeAvailability(offer: Pick<Offer, "status" | "startsAt" | "expiresAt">, now: Date = new Date()): Availability {
    if (offer.status !== "ACTIVE") return "INACTIVE";
    if (offer.startsAt && offer.startsAt > now) return "SCHEDULED";
    if (offer.expiresAt && offer.expiresAt < now) return "EXPIRED";
    return "LIVE";
  }

  private toResponse(offer: OfferWithProduct): OfferResponse {
    return {
      ...offer,
      availability: this.computeAvailability(offer),
      impliedDiscountBasisPoints: offer.compareAtPriceMinor
        ? impliedDiscountBasisPoints(offer.compareAtPriceMinor, offer.priceMinor)
        : 0,
    };
  }

  async list(query: OfferQueryDto): Promise<PaginatedResult<OfferResponse>> {
    const where: Prisma.OfferWhereInput = {
      productId: query.productId,
      status: query.status,
      currency: query.currency,
      ...(query.archived === true ? { archivedAt: { not: null } } : {}),
      ...(query.archived === false ? { archivedAt: null } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
              { product: { name: { contains: query.search, mode: "insensitive" } } },
              { product: { sku: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["name", "createdAt", "updatedAt", "status", "priceMinor"]);
    const orderBy: Prisma.OfferOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
        include: { product: { select: PRODUCT_SUMMARY_SELECT }, variants: { orderBy: { sortOrder: "asc" } } },
      }),
      this.prisma.offer.count({ where }),
    ]);

    return paginate(items.map((o) => this.toResponse(o as OfferWithProduct)), total, query);
  }

  async findOneOrThrow(id: string): Promise<OfferResponse> {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { product: { select: PRODUCT_SUMMARY_SELECT }, variants: { orderBy: { sortOrder: "asc" } } },
    });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    return this.toResponse(offer);
  }

  private assertPricingIsConsistent(priceMinor: number, compareAtPriceMinor: number | null | undefined): void {
    if (compareAtPriceMinor != null && compareAtPriceMinor < priceMinor) {
      throw new DomainException("VALIDATION_ERROR", "Sotuv narxi asl narxdan oshib ketmasligi kerak.", {
        field: "compareAtPriceMinor",
      });
    }
  }

  private assertDatesAreConsistent(startsAt: Date | null | undefined, expiresAt: Date | null | undefined): void {
    if (startsAt && expiresAt && startsAt >= expiresAt) {
      throw new DomainException("VALIDATION_ERROR", "Boshlanish sanasi tugash sanasidan oldin bo'lishi kerak.", {
        field: "startsAt",
      });
    }
  }

  async create(dto: CreateOfferDto, actorUserId: string | null): Promise<OfferResponse> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new DomainException("NOT_FOUND", "Mahsulot topilmadi.");

    await this.assertSlugAvailable(dto.slug);
    this.assertPricingIsConsistent(dto.priceMinor, dto.compareAtPriceMinor);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    this.assertDatesAreConsistent(startsAt, expiresAt);

    // Offer + its variants are created atomically: a variant insert failing after the Offer row
    // already committed would leave a commercially-incomplete Offer visible to the next list
    // query — exactly the "partial completion would create inconsistency" case the spec calls
    // out for transactional treatment.
    const created = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          productId: dto.productId,
          name: dto.name,
          slug: dto.slug,
          offerType: dto.offerType ?? "ONE_TIME",
          headline: dto.headline,
          subheadline: dto.subheadline,
          internalDescription: dto.internalDescription,
          priceMinor: dto.priceMinor,
          compareAtPriceMinor: dto.compareAtPriceMinor,
          currency: dto.currency ?? "UZS",
          bonuses: dto.bonuses,
          deliveryInfo: dto.deliveryInfo,
          paymentOptions: dto.paymentOptions ?? [],
          installmentOptions: dto.installmentOptions,
          ctaType: dto.ctaType ?? "BUY_NOW",
          ctaLabel: dto.ctaLabel,
          startsAt,
          expiresAt,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          isIndexable: dto.isIndexable ?? false,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });

      if (dto.variants && dto.variants.length > 0) {
        await tx.offerVariant.createMany({
          data: dto.variants.map((v, i) => ({
            offerId: offer.id,
            name: v.name,
            priceMinor: v.priceMinor,
            isDefault: v.isDefault ?? i === 0,
            sortOrder: v.sortOrder ?? i,
          })),
        });
      }

      return offer;
    });

    return this.findOneOrThrow(created.id);
  }

  async update(id: string, dto: UpdateOfferDto, actorUserId: string | null): Promise<OfferResponse> {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    if (existing.status === "ARCHIVED") {
      throw new DomainException("OFFER_ARCHIVED", "Arxivlangan offerni tahrirlab bo'lmaydi.");
    }
    if (dto.slug && dto.slug !== existing.slug) await this.assertSlugAvailable(dto.slug, id);

    const nextPrice = dto.priceMinor ?? existing.priceMinor;
    const nextCompareAt = dto.compareAtPriceMinor !== undefined ? dto.compareAtPriceMinor : existing.compareAtPriceMinor;
    this.assertPricingIsConsistent(nextPrice, nextCompareAt);

    const nextStartsAt = dto.startsAt !== undefined ? (dto.startsAt ? new Date(dto.startsAt) : null) : existing.startsAt;
    const nextExpiresAt = dto.expiresAt !== undefined ? (dto.expiresAt ? new Date(dto.expiresAt) : null) : existing.expiresAt;
    this.assertDatesAreConsistent(nextStartsAt, nextExpiresAt);

    await this.prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          offerType: dto.offerType,
          headline: dto.headline,
          subheadline: dto.subheadline,
          internalDescription: dto.internalDescription,
          priceMinor: dto.priceMinor,
          compareAtPriceMinor: dto.compareAtPriceMinor,
          currency: dto.currency,
          bonuses: dto.bonuses,
          deliveryInfo: dto.deliveryInfo,
          paymentOptions: dto.paymentOptions,
          installmentOptions: dto.installmentOptions,
          ctaType: dto.ctaType,
          ctaLabel: dto.ctaLabel,
          startsAt: nextStartsAt,
          expiresAt: nextExpiresAt,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          isIndexable: dto.isIndexable,
          updatedById: actorUserId,
        },
      });

      // Replace-all is the deliberate choice here, not a diff/merge — variants have no identity
      // the client can address individually in this DTO shape (no variant `id` round-trips), so
      // "replace the set" is the only unambiguous interpretation of "update variants".
      if (dto.variants) {
        await tx.offerVariant.deleteMany({ where: { offerId: id } });
        if (dto.variants.length > 0) {
          await tx.offerVariant.createMany({
            data: dto.variants.map((v, i) => ({
              offerId: id,
              name: v.name,
              priceMinor: v.priceMinor,
              isDefault: v.isDefault ?? i === 0,
              sortOrder: v.sortOrder ?? i,
            })),
          });
        }
      }
    });

    return this.findOneOrThrow(id);
  }

  private async transition(id: string, to: OfferStatus, actorUserId: string | null): Promise<OfferResponse> {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Offer topilmadi.");

    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(to)) {
      throw new DomainException(
        "INVALID_OFFER_TRANSITION",
        `Offer holatini "${existing.status}" dan "${to}" ga o'zgartirib bo'lmaydi.`,
        { from: existing.status, to, allowed },
      );
    }

    if (to === "ACTIVE") {
      const product = await this.prisma.product.findUnique({ where: { id: existing.productId } });
      if (product?.status === "ARCHIVED") {
        throw new DomainException(
          "PRODUCT_NOT_ELIGIBLE",
          "Arxivlangan mahsulotga tegishli offerni faollashtirib bo'lmaydi.",
        );
      }
    }

    await this.prisma.offer.update({
      where: { id },
      data: {
        status: to,
        archivedAt: to === "ARCHIVED" ? new Date() : existing.archivedAt,
        updatedById: actorUserId,
      },
    });
    return this.findOneOrThrow(id);
  }

  activate(id: string, actorUserId: string | null): Promise<OfferResponse> {
    return this.transition(id, "ACTIVE", actorUserId);
  }

  pause(id: string, actorUserId: string | null): Promise<OfferResponse> {
    return this.transition(id, "PAUSED", actorUserId);
  }

  archive(id: string, actorUserId: string | null): Promise<OfferResponse> {
    return this.transition(id, "ARCHIVED", actorUserId);
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.offer.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) throw new DomainException("SLUG_TAKEN", "Bu slug band.");
  }
}
