import { Inject, Injectable } from "@nestjs/common";
import type { Offer, OfferStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { impliedDiscountBasisPoints } from "../common/money/money";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import type { CreateOfferDto } from "./dto/create-offer.dto";
import type { UpdateOfferDto } from "./dto/update-offer.dto";
import type { OfferQueryDto } from "./dto/offer-query.dto";
import type { CatalogQueryDto } from "./dto/catalog-query.dto";

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

// Public-safe projection for the homepage's featured-products section — deliberately not
// OfferResponse: no internalDescription, no createdBy/updatedBy, no variants breakdown, nothing
// an anonymous buyer shouldn't see. Mirrors the same "narrow, hand-picked public shape" precedent
// as LandingsService.buildPublicResponse().
export interface PublicFeaturedOffer {
  id: string;
  slug: string;
  name: string;
  headline: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
}

// Server-enforced, never client-suppliable — see PublicOffersController. Small and fixed because
// this is a curated marketing surface, not a catalog (that's Phase E's /offers/catalog, which gets
// real pagination instead).
export const FEATURED_OFFERS_LIMIT = 8;

// The catalog's own page-size ceiling — smaller than PaginationQueryDto's generic 100-item admin
// bound, since this is a public, unauthenticated, higher-abuse-risk endpoint. Enforced again here
// (not just at the DTO validation layer) so a client can never request more per page than this
// regardless of what CatalogQueryDto's own @Max validator happens to allow.
export const CATALOG_MAX_PAGE_SIZE = 48;

export interface PublicCatalogOffer {
  id: string;
  slug: string;
  name: string;
  headline: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
  productType: string;
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
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {}

  // Product.images entries are stored as bare storage keys/filenames (see UploadsService /
  // ProductsService), not full URLs — the browser can't resolve a bare filename, so every public
  // projection that surfaces an image must run it through the storage adapter's publicUrl() first.
  // Already-absolute URLs (http(s)://...) are passed through unchanged so legacy/seeded data and
  // any future direct-URL uploads keep working.
  private toImageUrl(image: string | undefined | null): string | null {
    if (!image) return null;
    if (/^https?:\/\//i.test(image)) return image;
    return this.storage.publicUrl(image);
  }

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
          isFeatured: dto.isFeatured ?? false,
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
          isFeatured: dto.isFeatured,
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

  // Deliberately independent of the status transition matrix above (see the schema comment on
  // Offer.isFeatured) — featuring/unfeaturing is editorial curation, not a lifecycle change, so it
  // carries none of activate/pause/archive's eligibility rules. listFeaturedPublic() below is what
  // actually enforces "must also be live" for anonymous readers.
  private async setFeatured(id: string, isFeatured: boolean, actorUserId: string | null): Promise<OfferResponse> {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    await this.prisma.offer.update({ where: { id }, data: { isFeatured, updatedById: actorUserId } });
    return this.findOneOrThrow(id);
  }

  feature(id: string, actorUserId: string | null): Promise<OfferResponse> {
    return this.setFeatured(id, true, actorUserId);
  }

  unfeature(id: string, actorUserId: string | null): Promise<OfferResponse> {
    return this.setFeatured(id, false, actorUserId);
  }

  // One of two public list endpoints this API exposes (see PublicOffersController) —
  // `listCatalog` below is the other, now that Phase E's docs/PROHIBITED.md update allows a real
  // catalog. This one stays capped at the fixed FEATURED_OFFERS_LIMIT constant above, never a
  // caller-supplied value — it's the curated homepage section, not the catalog.
  async listFeaturedPublic(): Promise<PublicFeaturedOffer[]> {
    const now = new Date();
    const offers = await this.prisma.offer.findMany({
      where: {
        isFeatured: true,
        status: "ACTIVE",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: FEATURED_OFFERS_LIMIT,
      include: { product: { select: { images: true } } },
    });

    return offers.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      headline: o.headline,
      priceMinor: o.priceMinor,
      compareAtPriceMinor: o.compareAtPriceMinor,
      currency: o.currency,
      imageUrl: this.toImageUrl(o.product.images[0]),
    }));
  }

  // The real public catalog (Phase E) — deliberately still narrow: active/live offers only, no
  // search field (see CatalogQueryDto's own comment), and `take` is always clamped to
  // CATALOG_MAX_PAGE_SIZE server-side regardless of what the client requests or what
  // PaginationQueryDto's own DTO-level @Max validator happens to allow.
  async listCatalog(query: CatalogQueryDto): Promise<PaginatedResult<PublicCatalogOffer>> {
    const now = new Date();
    const take = Math.min(query.take, CATALOG_MAX_PAGE_SIZE);

    const where: Prisma.OfferWhereInput = {
      status: "ACTIVE",
      product: {
        status: { not: "ARCHIVED" },
        ...(query.type ? { type: query.type } : {}),
      },
      ...(query.minPriceMinor != null || query.maxPriceMinor != null
        ? { priceMinor: { ...(query.minPriceMinor != null ? { gte: query.minPriceMinor } : {}), ...(query.maxPriceMinor != null ? { lte: query.maxPriceMinor } : {}) } }
        : {}),
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    };

    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: query.skip,
        take,
        include: { product: { select: { images: true, type: true } } },
      }),
      this.prisma.offer.count({ where }),
    ]);

    const items = offers.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      headline: o.headline,
      priceMinor: o.priceMinor,
      compareAtPriceMinor: o.compareAtPriceMinor,
      currency: o.currency,
      imageUrl: this.toImageUrl(o.product.images[0]),
      productType: o.product.type,
    }));

    return { items, page: query.page, pageSize: take, total, totalPages: Math.max(1, Math.ceil(total / take)) };
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.offer.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) throw new DomainException("SLUG_TAKEN", "Bu slug band.");
  }
}
