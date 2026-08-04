import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { LandingPage, LandingSection, LandingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OffersService } from "../offers/offers.service";
import { DeliveryService, type DeliveryRegionPublicResponse } from "../delivery/delivery.service";
import { DomainException } from "../common/errors/domain-error";
import { impliedDiscountBasisPoints } from "../common/money/money";
import type { CreateLandingDto } from "./dto/create-landing.dto";
import type { UpdateLandingDto } from "./dto/update-landing.dto";
import type { CreateLandingSectionDto, UpdateLandingSectionDto } from "./dto/landing-section.dto";

export interface LandingResponse {
  id: string;
  offerId: string;
  template: string;
  status: LandingStatus;
  publishedAt: Date | null;
  archivedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  ogImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LandingSectionResponse {
  id: string;
  offerId: string;
  type: LandingSection["type"];
  sortOrder: number;
  isActive: boolean;
  content: Prisma.JsonValue;
}

// Buyer-safe shape only — never includes internalDescription, createdById/updatedById,
// archivedAt, or any Product field beyond `type`/`images` (no sku/costPriceMinor/internalNotes).
export interface PublicLandingResponse {
  offer: {
    id: string;
    productId: string;
    name: string;
    slug: string;
    headline: string;
    subheadline: string | null;
    description: string | null;
    priceMinor: number;
    compareAtPriceMinor: number | null;
    currency: string;
    // Resolved to public URLs (see toImageUrl) — the Hero/Gallery sections render these directly,
    // matching the same resolution ProductCard/FeaturedProducts already do for the catalog grid.
    images: string[];
    variants: { id: string; name: string; priceMinor: number; isDefault: boolean }[];
    bonuses: Prisma.JsonValue;
    deliveryInfo: Prisma.JsonValue;
    paymentOptions: string[];
    installmentOptions: Prisma.JsonValue;
    ctaType: string;
    ctaLabel: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    status: string;
    availability: string;
    impliedDiscountBasisPoints: number;
  };
  productType: string;
  // Only populated (non-empty) when productType === "PHYSICAL_PRODUCT" — see DeliveryService.
  // COURSE/DIGITAL/SERVICE/CONSULTATION offers always get an empty array here, never delivery UI.
  deliveryRegions: DeliveryRegionPublicResponse[];
  landing: {
    template: string;
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string[];
    ogImageUrl: string | null;
  };
  sections: LandingSectionResponse[];
}

const ALLOWED_TRANSITIONS: Record<LandingStatus, LandingStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

@Injectable()
export class LandingsService {
  constructor(
    private prisma: PrismaService,
    private offers: OffersService,
    private delivery: DeliveryService,
    private config: ConfigService,
  ) {}

  // Same resolution OffersService.toImageUrl uses for the catalog/featured cards — kept as a
  // small local copy rather than a shared export, matching this codebase's existing convention
  // (each service that needs it has its own copy; see also the now-deleted products-view.service).
  private toImageUrl(imagePath: string): string {
    // A real upload already returns a full absolute publicUrl (see offers.service.ts's identical
    // helper for the full explanation) — only an old relative-path fixture needs the base URL
    // prepended.
    if (/^https?:\/\//.test(imagePath)) return imagePath;
    const publicBaseUrl = this.config.get<string>("storage.publicBaseUrl");
    if (!publicBaseUrl) return imagePath;
    return `${publicBaseUrl}/${imagePath}`;
  }

  private toResponse(landing: LandingPage): LandingResponse {
    return {
      id: landing.id,
      offerId: landing.offerId,
      template: landing.template,
      status: landing.status,
      publishedAt: landing.publishedAt,
      archivedAt: landing.archivedAt,
      seoTitle: landing.seoTitle,
      seoDescription: landing.seoDescription,
      seoKeywords: landing.seoKeywords,
      ogImageUrl: landing.ogImageUrl,
      createdAt: landing.createdAt,
      updatedAt: landing.updatedAt,
    };
  }

  private toSectionResponse(section: LandingSection, offerId: string): LandingSectionResponse {
    return {
      id: section.id,
      offerId,
      type: section.type,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      content: section.content,
    };
  }

  async findByOfferIdOrThrow(offerId: string): Promise<LandingResponse> {
    const landing = await this.prisma.landingPage.findUnique({ where: { offerId } });
    if (!landing) throw new DomainException("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
    return this.toResponse(landing);
  }

  async create(offerId: string, dto: CreateLandingDto, actorUserId: string | null): Promise<LandingResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");

    const existing = await this.prisma.landingPage.findUnique({ where: { offerId } });
    if (existing) throw new DomainException("LANDING_ALREADY_EXISTS", "Bu offer uchun landing sahifa allaqachon mavjud.");

    const landing = await this.prisma.landingPage.create({
      data: {
        offerId,
        template: dto.template ?? "default",
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        seoKeywords: dto.seoKeywords ?? [],
        ogImageUrl: dto.ogImageUrl,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
    return this.toResponse(landing);
  }

  async update(offerId: string, dto: UpdateLandingDto, actorUserId: string | null): Promise<LandingResponse> {
    const existing = await this.prisma.landingPage.findUnique({ where: { offerId } });
    if (!existing) throw new DomainException("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
    if (existing.status === "ARCHIVED") {
      throw new DomainException("LANDING_ARCHIVED", "Arxivlangan landing sahifani tahrirlab bo'lmaydi.");
    }

    const landing = await this.prisma.landingPage.update({
      where: { offerId },
      data: {
        template: dto.template,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        seoKeywords: dto.seoKeywords,
        ogImageUrl: dto.ogImageUrl,
        updatedById: actorUserId,
      },
    });
    return this.toResponse(landing);
  }

  private async transition(offerId: string, to: LandingStatus, actorUserId: string | null): Promise<LandingResponse> {
    const existing = await this.prisma.landingPage.findUnique({ where: { offerId } });
    if (!existing) throw new DomainException("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");

    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(to)) {
      throw new DomainException(
        "INVALID_LANDING_TRANSITION",
        `Landing holatini "${existing.status}" dan "${to}" ga o'zgartirib bo'lmaydi.`,
        { from: existing.status, to, allowed },
      );
    }

    const landing = await this.prisma.landingPage.update({
      where: { offerId },
      data: {
        status: to,
        publishedAt: to === "PUBLISHED" ? new Date() : existing.publishedAt,
        archivedAt: to === "ARCHIVED" ? new Date() : existing.archivedAt,
        updatedById: actorUserId,
      },
    });
    return this.toResponse(landing);
  }

  publish(offerId: string, actorUserId: string | null): Promise<LandingResponse> {
    return this.transition(offerId, "PUBLISHED", actorUserId);
  }

  unpublish(offerId: string, actorUserId: string | null): Promise<LandingResponse> {
    return this.transition(offerId, "DRAFT", actorUserId);
  }

  archive(offerId: string, actorUserId: string | null): Promise<LandingResponse> {
    return this.transition(offerId, "ARCHIVED", actorUserId);
  }

  // ---- Sections ----

  private async findLandingOrThrow(offerId: string): Promise<LandingPage> {
    const landing = await this.prisma.landingPage.findUnique({ where: { offerId } });
    if (!landing) throw new DomainException("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
    return landing;
  }

  async listSections(offerId: string): Promise<LandingSectionResponse[]> {
    const landing = await this.findLandingOrThrow(offerId);
    const sections = await this.prisma.landingSection.findMany({
      where: { landingPageId: landing.id },
      orderBy: { sortOrder: "asc" },
    });
    return sections.map((s) => this.toSectionResponse(s, offerId));
  }

  async addSection(offerId: string, dto: CreateLandingSectionDto): Promise<LandingSectionResponse> {
    const landing = await this.findLandingOrThrow(offerId);
    if (landing.status === "ARCHIVED") {
      throw new DomainException("LANDING_ARCHIVED", "Arxivlangan landing sahifaga section qo'shib bo'lmaydi.");
    }
    const count = await this.prisma.landingSection.count({ where: { landingPageId: landing.id } });
    const section = await this.prisma.landingSection.create({
      data: {
        landingPageId: landing.id,
        type: dto.type,
        content: (dto.content ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? count,
      },
    });
    return this.toSectionResponse(section, offerId);
  }

  private async findSectionOrThrow(id: string): Promise<LandingSection & { offerId: string }> {
    const section = await this.prisma.landingSection.findUnique({
      where: { id },
      include: { landingPage: { select: { offerId: true, status: true } } },
    });
    if (!section) throw new DomainException("NOT_FOUND", "Section topilmadi.");
    return { ...section, offerId: section.landingPage.offerId };
  }

  async updateSection(id: string, dto: UpdateLandingSectionDto): Promise<LandingSectionResponse> {
    const existing = await this.findSectionOrThrow(id);
    const section = await this.prisma.landingSection.update({
      where: { id },
      data: {
        content: dto.content !== undefined ? (dto.content as Prisma.InputJsonValue) : undefined,
        isActive: dto.isActive,
      },
    });
    return this.toSectionResponse(section, existing.offerId);
  }

  async removeSection(id: string): Promise<void> {
    const existing = await this.findSectionOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.landingSection.delete({ where: { id } });
      const remaining = await tx.landingSection.findMany({
        where: { landingPageId: existing.landingPageId },
        orderBy: { sortOrder: "asc" },
      });
      await Promise.all(remaining.map((s, i) => tx.landingSection.update({ where: { id: s.id }, data: { sortOrder: i } })));
    });
  }

  async reorderSections(offerId: string, orderedIds: string[]): Promise<LandingSectionResponse[]> {
    const landing = await this.findLandingOrThrow(offerId);
    const existing = await this.prisma.landingSection.findMany({ where: { landingPageId: landing.id } });
    const existingIds = new Set(existing.map((s) => s.id));
    if (orderedIds.length !== existing.length || !orderedIds.every((id) => existingIds.has(id))) {
      throw new DomainException("VALIDATION_ERROR", "orderedIds ushbu landingning barcha sectionlarini aniq bir marta o'z ichiga olishi kerak.");
    }

    await this.prisma.$transaction(orderedIds.map((id, i) => this.prisma.landingSection.update({ where: { id }, data: { sortOrder: i } })));
    return this.listSections(offerId);
  }

  // ---- Preview (admin, authenticated — bypasses the publish gate) ----

  async preview(offerId: string): Promise<PublicLandingResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId }, include: { product: true, variants: true } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");
    const landing = await this.prisma.landingPage.findUnique({ where: { offerId }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
    if (!landing) throw new DomainException("NOT_FOUND", "Bu offer uchun landing sahifa topilmadi.");
    return this.buildPublicResponse(offer, landing, landing.sections);
  }

  // ---- Public (buyer-facing, no auth) ----

  // The one and only public read of an Offer's landing (see API.md's `GET /offers/:slug/public`).
  // Returns null (mapped to 404 by the controller) unless the Offer exists, is not archived, has
  // a LandingPage, and that LandingPage is PUBLISHED — anything else must look identical to "this
  // page has never existed" to an unauthenticated caller.
  async getPublicByOfferSlug(slug: string): Promise<PublicLandingResponse | null> {
    const offer = await this.prisma.offer.findUnique({ where: { slug }, include: { product: true, variants: true } });
    if (!offer || offer.status === "ARCHIVED") return null;

    const landing = await this.prisma.landingPage.findUnique({
      where: { offerId: offer.id },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
    if (!landing || landing.status !== "PUBLISHED") return null;

    const activeSections = landing.sections.filter((s) => s.isActive);
    return this.buildPublicResponse(offer, landing, activeSections);
  }

  private async buildPublicResponse(
    offer: Prisma.OfferGetPayload<{ include: { product: true; variants: true } }>,
    landing: LandingPage,
    sections: LandingSection[],
  ): Promise<PublicLandingResponse> {
    const deliveryRegions =
      offer.product.type === "PHYSICAL_PRODUCT" ? await this.delivery.listActiveRegionsForOffer(offer.id) : [];
    return {
      offer: {
        id: offer.id,
        productId: offer.productId,
        name: offer.name,
        slug: offer.slug,
        headline: offer.headline,
        subheadline: offer.subheadline,
        description: offer.product.description,
        priceMinor: offer.priceMinor,
        compareAtPriceMinor: offer.compareAtPriceMinor,
        currency: offer.currency,
        images: offer.product.images.map((img) => this.toImageUrl(img)),
        variants: offer.variants.map((v) => ({ id: v.id, name: v.name, priceMinor: v.priceMinor, isDefault: v.isDefault })),
        bonuses: offer.bonuses,
        deliveryInfo: offer.deliveryInfo,
        paymentOptions: offer.paymentOptions,
        installmentOptions: offer.installmentOptions,
        ctaType: offer.ctaType,
        ctaLabel: offer.ctaLabel,
        startsAt: offer.startsAt,
        endsAt: offer.expiresAt,
        status: offer.status,
        availability: this.offers.computeAvailability(offer),
        impliedDiscountBasisPoints: offer.compareAtPriceMinor
          ? impliedDiscountBasisPoints(offer.compareAtPriceMinor, offer.priceMinor)
          : 0,
      },
      productType: offer.product.type,
      deliveryRegions,
      landing: {
        template: landing.template,
        seoTitle: landing.seoTitle,
        seoDescription: landing.seoDescription,
        seoKeywords: landing.seoKeywords,
        ogImageUrl: landing.ogImageUrl,
      },
      sections: sections.map((s) => this.toSectionResponse(s, offer.id)),
    };
  }
}
