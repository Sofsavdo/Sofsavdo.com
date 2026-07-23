import { Injectable } from "@nestjs/common";
import type { Campaign, CampaignStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { isValidBasisPoints } from "../common/money/money";
import type { CreateCampaignDto } from "./dto/create-campaign.dto";
import type { UpdateCampaignDto } from "./dto/update-campaign.dto";
import type { CampaignQueryDto } from "./dto/campaign-query.dto";
import type { CreatorCampaignQueryDto } from "./dto/creator-campaign-query.dto";
import { CampaignMediaService, type CampaignMediaCreatorResponse } from "../campaign-media/campaign-media.service";

export type CampaignAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";
export type ApplicationAvailability = "OPEN" | "NOT_STARTED" | "CLOSED" | "FULL" | "INACTIVE";

const PRODUCT_SUMMARY_SELECT = { id: true, name: true, slug: true, sku: true, status: true, type: true } satisfies Prisma.ProductSelect;
const OFFER_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  currency: true,
  status: true,
  archivedAt: true,
  product: { select: PRODUCT_SUMMARY_SELECT },
  landingPage: { select: { status: true } },
} satisfies Prisma.OfferSelect;

type CampaignWithRelations = Campaign & {
  offer: {
    id: string;
    name: string;
    slug: string;
    priceMinor: number;
    compareAtPriceMinor: number | null;
    currency: string;
    status: string;
    archivedAt: Date | null;
    product: { id: string; name: string; slug: string; sku: string | null; status: string; type: string };
    landingPage: { status: string } | null;
  };
  _count?: { creatorCampaigns: number };
};

export interface CampaignAdminResponse extends Campaign {
  availability: CampaignAvailability;
  applicationAvailability: ApplicationAvailability;
  approvedCreatorCount: number;
  commissionSource: "CAMPAIGN";
  offer: { id: string; name: string; slug: string; priceMinor: number; compareAtPriceMinor: number | null; currency: string; status: string };
  product: { id: string; name: string; slug: string; sku: string | null; status: string; type: string };
  landingAvailability: "PUBLISHED" | "NOT_PUBLISHED" | "MISSING";
  media: CampaignMediaCreatorResponse[];
}

// Buyer/creator-safe shape — never internalName/internalNotes/createdById/updatedById/archivedAt/
// raw stored `status` (see LandingsService's PublicLandingResponse for the same pattern).
export interface CampaignCreatorResponse {
  id: string;
  offerId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  ctaLabel: string;
  goal: string | null;
  targetAudience: string | null;
  platforms: string[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  requiredContentCount: number | null;
  contentDeadline: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  applicationStartDate: Date | null;
  applicationDeadline: Date | null;
  creatorLimit: number | null;
  requiresApproval: boolean;
  commissionType: string;
  commissionRateBps: number | null;
  commissionAmountMinor: number | null;
  commissionCurrency: string;
  customerDiscountType: string | null;
  customerDiscountValue: number | null;
  barterEnabled: boolean;
  freeProduct: string | null;
  attributionWindowDays: number;
  availability: CampaignAvailability;
  applicationAvailability: ApplicationAvailability;
  approvedCreatorCount: number;
  commissionSource: "CAMPAIGN";
  offer: { id: string; name: string; slug: string; priceMinor: number; compareAtPriceMinor: number | null; currency: string };
  product: { id: string; name: string; type: string };
  media: CampaignMediaCreatorResponse[];
}

const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private campaignMedia: CampaignMediaService,
  ) {}

  // Stored `status` (admin-driven) vs. computed `availability` (date+status derived, never
  // persisted) vs. `applicationAvailability` (also considers capacity) are three separate
  // concepts — never conflated into one field. Mirrors OffersService.computeAvailability().
  computeAvailability(campaign: Pick<Campaign, "status" | "startDate" | "endDate">, now: Date = new Date()): CampaignAvailability {
    if (campaign.status !== "ACTIVE") return "INACTIVE";
    if (campaign.startDate && campaign.startDate > now) return "SCHEDULED";
    if (campaign.endDate && campaign.endDate < now) return "EXPIRED";
    return "LIVE";
  }

  computeApplicationAvailability(
    campaign: Pick<Campaign, "status" | "applicationStartDate" | "applicationDeadline" | "creatorLimit">,
    approvedCreatorCount: number,
    now: Date = new Date(),
  ): ApplicationAvailability {
    if (campaign.status !== "ACTIVE") return "INACTIVE";
    if (campaign.applicationStartDate && campaign.applicationStartDate > now) return "NOT_STARTED";
    if (campaign.applicationDeadline && campaign.applicationDeadline < now) return "CLOSED";
    if (campaign.creatorLimit != null && approvedCreatorCount >= campaign.creatorLimit) return "FULL";
    return "OPEN";
  }

  private landingAvailability(offer: CampaignWithRelations["offer"]): "PUBLISHED" | "NOT_PUBLISHED" | "MISSING" {
    if (!offer.landingPage) return "MISSING";
    return offer.landingPage.status === "PUBLISHED" ? "PUBLISHED" : "NOT_PUBLISHED";
  }

  private async approvedCreatorCount(campaignId: string): Promise<number> {
    return this.prisma.creatorCampaign.count({ where: { campaignId, status: "ACTIVE" } });
  }

  private async toAdminResponse(campaign: CampaignWithRelations): Promise<CampaignAdminResponse> {
    const approvedCreatorCount = campaign._count?.creatorCampaigns ?? (await this.approvedCreatorCount(campaign.id));
    const media = await this.campaignMedia.listCreatorSafe(campaign.id);
    return {
      ...campaign,
      availability: this.computeAvailability(campaign),
      applicationAvailability: this.computeApplicationAvailability(campaign, approvedCreatorCount),
      approvedCreatorCount,
      commissionSource: "CAMPAIGN",
      offer: {
        id: campaign.offer.id,
        name: campaign.offer.name,
        slug: campaign.offer.slug,
        priceMinor: campaign.offer.priceMinor,
        compareAtPriceMinor: campaign.offer.compareAtPriceMinor,
        currency: campaign.offer.currency,
        status: campaign.offer.status,
      },
      product: campaign.offer.product,
      landingAvailability: this.landingAvailability(campaign.offer),
      media,
    };
  }

  private async toCreatorResponse(campaign: CampaignWithRelations, precomputedMedia?: CampaignMediaCreatorResponse[]): Promise<CampaignCreatorResponse> {
    const approvedCreatorCount = campaign._count?.creatorCampaigns ?? (await this.approvedCreatorCount(campaign.id));
    const media = precomputedMedia ?? (await this.campaignMedia.listCreatorSafe(campaign.id));
    return {
      id: campaign.id,
      offerId: campaign.offerId,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      category: campaign.category,
      ctaLabel: campaign.ctaLabel,
      goal: campaign.goal,
      targetAudience: campaign.targetAudience,
      platforms: campaign.platforms,
      contentFormats: campaign.contentFormats,
      requiredElements: campaign.requiredElements,
      forbiddenElements: campaign.forbiddenElements,
      referenceContent: campaign.referenceContent,
      minFollowers: campaign.minFollowers,
      maxFollowers: campaign.maxFollowers,
      requiredContentCount: campaign.requiredContentCount,
      contentDeadline: campaign.contentDeadline,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      applicationStartDate: campaign.applicationStartDate,
      applicationDeadline: campaign.applicationDeadline,
      creatorLimit: campaign.creatorLimit,
      requiresApproval: campaign.requiresApproval,
      commissionType: campaign.commissionType,
      commissionRateBps: campaign.commissionRateBps,
      commissionAmountMinor: campaign.commissionAmountMinor,
      commissionCurrency: campaign.commissionCurrency,
      customerDiscountType: campaign.customerDiscountType,
      customerDiscountValue: campaign.customerDiscountValue,
      barterEnabled: campaign.barterEnabled,
      freeProduct: campaign.freeProduct,
      attributionWindowDays: campaign.attributionWindowDays,
      availability: this.computeAvailability(campaign),
      applicationAvailability: this.computeApplicationAvailability(campaign, approvedCreatorCount),
      approvedCreatorCount,
      commissionSource: "CAMPAIGN",
      offer: {
        id: campaign.offer.id,
        name: campaign.offer.name,
        slug: campaign.offer.slug,
        priceMinor: campaign.offer.priceMinor,
        compareAtPriceMinor: campaign.offer.compareAtPriceMinor,
        currency: campaign.offer.currency,
      },
      product: { id: campaign.offer.product.id, name: campaign.offer.product.name, type: campaign.offer.product.type },
      media,
    };
  }

  private assertDatesAreConsistent(dto: { startDate?: Date | null; endDate?: Date | null; applicationStartDate?: Date | null; applicationDeadline?: Date | null }): void {
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new DomainException("VALIDATION_ERROR", "Kampaniya boshlanish sanasi tugash sanasidan oldin bo'lishi kerak.", { field: "startDate" });
    }
    if (dto.applicationStartDate && dto.applicationDeadline && dto.applicationStartDate >= dto.applicationDeadline) {
      throw new DomainException("VALIDATION_ERROR", "Ariza boshlanish sanasi tugash sanasidan oldin bo'lishi kerak.", { field: "applicationStartDate" });
    }
  }

  // Enforces the two-mode mutual exclusivity at the service layer (the
  // Campaign_commission_mode_check DB constraint is the last-resort backstop — see the 6B
  // Enhancement migration and DECISIONS.md ADR-013). Deterministic integer bounds only, never
  // floating point.
  private assertCommissionIsValid(dto: {
    commissionType: string;
    commissionRateBps?: number | null;
    commissionAmountMinor?: number | null;
    offerPriceMinor: number;
  }): void {
    if (dto.commissionType === "PERCENTAGE") {
      if (dto.commissionAmountMinor != null) {
        throw new DomainException("VALIDATION_ERROR", "PERCENTAGE rejimida commissionAmountMinor bo'sh bo'lishi kerak.", {
          field: "commissionAmountMinor",
        });
      }
      if (dto.commissionRateBps == null || !isValidBasisPoints(dto.commissionRateBps) || dto.commissionRateBps <= 0) {
        throw new DomainException("VALIDATION_ERROR", "Komissiya foizi 0 dan katta va 100% dan kichik yoki teng bo'lishi kerak.", {
          field: "commissionRateBps",
        });
      }
    } else if (dto.commissionType === "FIXED_AMOUNT") {
      if (dto.commissionRateBps != null) {
        throw new DomainException("VALIDATION_ERROR", "FIXED_AMOUNT rejimida commissionRateBps bo'sh bo'lishi kerak.", {
          field: "commissionRateBps",
        });
      }
      if (dto.commissionAmountMinor == null || dto.commissionAmountMinor <= 0) {
        throw new DomainException("VALIDATION_ERROR", "Qat'iy komissiya summasi musbat bo'lishi kerak.", { field: "commissionAmountMinor" });
      }
      if (dto.commissionAmountMinor > dto.offerPriceMinor) {
        throw new DomainException("VALIDATION_ERROR", "Qat'iy komissiya summasi offer narxidan oshib ketmasligi kerak.", {
          field: "commissionAmountMinor",
        });
      }
    }
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.campaign.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) throw new DomainException("SLUG_TAKEN", "Bu slug band.");
  }

  async list(query: CampaignQueryDto): Promise<PaginatedResult<CampaignAdminResponse>> {
    const where: Prisma.CampaignWhereInput = {
      offerId: query.offerId,
      status: query.status,
      requiresApproval: query.requiresApproval,
      ...(query.platform ? { platforms: { has: query.platform } } : {}),
      ...(query.productId ? { offer: { productId: query.productId } } : {}),
      ...(query.archived === true ? { archivedAt: { not: null } } : {}),
      ...(query.archived === false ? { archivedAt: null } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { internalName: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
              { offer: { name: { contains: query.search, mode: "insensitive" } } },
              { offer: { slug: { contains: query.search, mode: "insensitive" } } },
              { offer: { product: { name: { contains: query.search, mode: "insensitive" } } } },
              { offer: { product: { sku: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["name", "createdAt", "updatedAt", "status", "startDate", "endDate"]);
    const orderBy: Prisma.CampaignOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
        include: { offer: { select: OFFER_SUMMARY_SELECT }, _count: { select: { creatorCampaigns: { where: { status: "ACTIVE" } } } } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    const mapped = await Promise.all(items.map((c) => this.toAdminResponse(c as CampaignWithRelations)));
    return paginate(mapped, total, query);
  }

  async findOneOrThrow(id: string): Promise<CampaignAdminResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { offer: { select: OFFER_SUMMARY_SELECT } },
    });
    if (!campaign) throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");
    return this.toAdminResponse(campaign);
  }

  async create(dto: CreateCampaignDto, actorUserId: string | null): Promise<CampaignAdminResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { id: dto.offerId } });
    if (!offer) throw new DomainException("NOT_FOUND", "Offer topilmadi.");

    await this.assertSlugAvailable(dto.slug);
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    const applicationStartDate = dto.applicationStartDate ? new Date(dto.applicationStartDate) : null;
    const applicationDeadline = dto.applicationDeadline ? new Date(dto.applicationDeadline) : null;
    const contentDeadline = dto.contentDeadline ? new Date(dto.contentDeadline) : null;
    this.assertDatesAreConsistent({ startDate, endDate, applicationStartDate, applicationDeadline });
    this.assertCommissionIsValid({
      commissionType: dto.commissionType,
      commissionRateBps: dto.commissionRateBps,
      commissionAmountMinor: dto.commissionAmountMinor,
      offerPriceMinor: offer.priceMinor,
    });

    const created = await this.prisma.campaign.create({
      data: {
        offerId: dto.offerId,
        name: dto.name,
        internalName: dto.internalName,
        slug: dto.slug,
        description: dto.description,
        internalNotes: dto.internalNotes,
        category: dto.category,
        ctaLabel: dto.ctaLabel,
        goal: dto.goal,
        targetAudience: dto.targetAudience,
        platforms: dto.platforms ?? [],
        contentFormats: dto.contentFormats ?? [],
        requiredElements: dto.requiredElements ?? [],
        forbiddenElements: dto.forbiddenElements ?? [],
        referenceContent: dto.referenceContent ?? [],
        minFollowers: dto.minFollowers,
        maxFollowers: dto.maxFollowers,
        requiredContentCount: dto.requiredContentCount,
        contentDeadline,
        startDate,
        endDate,
        applicationStartDate,
        applicationDeadline,
        creatorLimit: dto.creatorLimit,
        requiresApproval: dto.requiresApproval ?? true,
        commissionType: dto.commissionType,
        commissionRateBps: dto.commissionRateBps,
        commissionAmountMinor: dto.commissionAmountMinor,
        commissionCurrency: dto.commissionCurrency ?? "UZS",
        customerDiscountType: dto.customerDiscountType,
        customerDiscountValue: dto.customerDiscountValue,
        barterEnabled: dto.barterEnabled ?? false,
        freeProduct: dto.freeProduct,
        attributionWindowDays: dto.attributionWindowDays ?? 30,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });

    return this.findOneOrThrow(created.id);
  }

  async update(id: string, dto: UpdateCampaignDto, actorUserId: string | null): Promise<CampaignAdminResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id }, include: { offer: true } });
    if (!existing) throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");
    if (existing.status === "ARCHIVED") throw new DomainException("CAMPAIGN_ARCHIVED", "Arxivlangan kampaniyani tahrirlab bo'lmaydi.");
    if (dto.slug && dto.slug !== existing.slug) await this.assertSlugAvailable(dto.slug, id);

    const startDate = dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : existing.startDate;
    const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate;
    const applicationStartDate =
      dto.applicationStartDate !== undefined ? (dto.applicationStartDate ? new Date(dto.applicationStartDate) : null) : existing.applicationStartDate;
    const applicationDeadline =
      dto.applicationDeadline !== undefined ? (dto.applicationDeadline ? new Date(dto.applicationDeadline) : null) : existing.applicationDeadline;
    const contentDeadline = dto.contentDeadline !== undefined ? (dto.contentDeadline ? new Date(dto.contentDeadline) : null) : existing.contentDeadline;
    this.assertDatesAreConsistent({ startDate, endDate, applicationStartDate, applicationDeadline });

    const nextCommissionType = dto.commissionType ?? existing.commissionType;
    // When commissionType is being changed, the OTHER mode's field must be explicitly cleared —
    // Prisma leaves a field untouched (not nulled) when it's `undefined` in `data`, so a naive
    // `dto.x ?? existing.x` would leave a stale value from the previous mode sitting alongside
    // the new one, silently violating the mutual-exclusivity rule in the database.
    const nextCommissionRateBps = dto.commissionType !== undefined ? (dto.commissionRateBps ?? null) : (dto.commissionRateBps ?? existing.commissionRateBps);
    const nextCommissionAmountMinor =
      dto.commissionType !== undefined ? (dto.commissionAmountMinor ?? null) : (dto.commissionAmountMinor ?? existing.commissionAmountMinor);
    this.assertCommissionIsValid({
      commissionType: nextCommissionType,
      commissionRateBps: nextCommissionRateBps,
      commissionAmountMinor: nextCommissionAmountMinor,
      offerPriceMinor: existing.offer.priceMinor,
    });

    await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        internalName: dto.internalName,
        slug: dto.slug,
        description: dto.description,
        internalNotes: dto.internalNotes,
        category: dto.category,
        ctaLabel: dto.ctaLabel,
        goal: dto.goal,
        targetAudience: dto.targetAudience,
        platforms: dto.platforms,
        contentFormats: dto.contentFormats,
        requiredElements: dto.requiredElements,
        forbiddenElements: dto.forbiddenElements,
        referenceContent: dto.referenceContent,
        minFollowers: dto.minFollowers,
        maxFollowers: dto.maxFollowers,
        requiredContentCount: dto.requiredContentCount,
        contentDeadline,
        startDate,
        endDate,
        applicationStartDate,
        applicationDeadline,
        creatorLimit: dto.creatorLimit,
        requiresApproval: dto.requiresApproval,
        commissionType: dto.commissionType,
        commissionRateBps: nextCommissionRateBps,
        commissionAmountMinor: nextCommissionAmountMinor,
        commissionCurrency: dto.commissionCurrency,
        customerDiscountType: dto.customerDiscountType,
        customerDiscountValue: dto.customerDiscountValue,
        barterEnabled: dto.barterEnabled,
        freeProduct: dto.freeProduct,
        attributionWindowDays: dto.attributionWindowDays,
        updatedById: actorUserId,
      },
    });

    return this.findOneOrThrow(id);
  }

  private assertActivationEligible(campaign: Campaign & { offer: CampaignWithRelations["offer"] }): void {
    const { offer } = campaign;
    if (offer.archivedAt || offer.status === "ARCHIVED") {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Bog'langan offer arxivlangan — kampaniyani faollashtirib bo'lmaydi.", { reason: "OFFER_ARCHIVED" });
    }
    if (offer.status !== "ACTIVE") {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Bog'langan offer faol emas — kampaniyani faollashtirib bo'lmaydi.", { reason: "OFFER_NOT_ACTIVE" });
    }
    if (!offer.landingPage) {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Bog'langan offer uchun landing sahifa mavjud emas.", { reason: "LANDING_MISSING" });
    }
    if (offer.landingPage.status !== "PUBLISHED") {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Bog'langan landing sahifa e'lon qilinmagan.", { reason: "LANDING_NOT_PUBLISHED" });
    }
    if (!campaign.category || !campaign.ctaLabel || campaign.platforms.length === 0 || campaign.contentFormats.length === 0) {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Kampaniya konfiguratsiyasi to'liq emas (category/ctaLabel/platforms/contentFormats).", {
        reason: "CONFIG_INCOMPLETE",
      });
    }
    if (campaign.startDate && campaign.endDate && campaign.startDate >= campaign.endDate) {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Kampaniya sanalari noto'g'ri.", { reason: "INVALID_DATES" });
    }
    if (campaign.creatorLimit != null && campaign.creatorLimit < 1) {
      throw new DomainException("CAMPAIGN_NOT_ELIGIBLE", "Creator limiti noto'g'ri.", { reason: "INVALID_CAPACITY" });
    }
    this.assertCommissionIsValid({
      commissionType: campaign.commissionType,
      commissionRateBps: campaign.commissionRateBps,
      commissionAmountMinor: campaign.commissionAmountMinor,
      offerPriceMinor: offer.priceMinor,
    });
  }

  private async transition(id: string, to: CampaignStatus, actorUserId: string | null): Promise<CampaignAdminResponse> {
    const existing = await this.prisma.campaign.findUnique({ where: { id }, include: { offer: { select: OFFER_SUMMARY_SELECT } } });
    if (!existing) throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");

    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(to)) {
      throw new DomainException(
        "INVALID_CAMPAIGN_TRANSITION",
        `Kampaniya holatini "${existing.status}" dan "${to}" ga o'zgartirib bo'lmaydi.`,
        { from: existing.status, to, allowed },
      );
    }

    if (to === "ACTIVE") {
      this.assertActivationEligible(existing);
    }

    await this.prisma.campaign.update({
      where: { id },
      data: {
        status: to,
        archivedAt: to === "ARCHIVED" ? new Date() : existing.archivedAt,
        updatedById: actorUserId,
      },
    });
    return this.findOneOrThrow(id);
  }

  activate(id: string, actorUserId: string | null): Promise<CampaignAdminResponse> {
    return this.transition(id, "ACTIVE", actorUserId);
  }

  pause(id: string, actorUserId: string | null): Promise<CampaignAdminResponse> {
    return this.transition(id, "PAUSED", actorUserId);
  }

  complete(id: string, actorUserId: string | null): Promise<CampaignAdminResponse> {
    return this.transition(id, "COMPLETED", actorUserId);
  }

  archive(id: string, actorUserId: string | null): Promise<CampaignAdminResponse> {
    return this.transition(id, "ARCHIVED", actorUserId);
  }

  // ---- Creator-facing (authenticated creator only — see RBAC.md's "interim state" note) ----

  async listForCreator(query: CreatorCampaignQueryDto): Promise<CampaignCreatorResponse[]> {
    const now = new Date();
    const where: Prisma.CampaignWhereInput = {
      status: "ACTIVE",
      ...(query.platform ? { platforms: { has: query.platform } } : {}),
      ...(query.contentFormat ? { contentFormats: { has: query.contentFormat } } : {}),
      ...(query.commissionType ? { commissionType: query.commissionType } : {}),
      ...(query.category ? { category: { equals: query.category, mode: "insensitive" } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { offer: { product: { name: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    // `status: "ACTIVE"` is the DB-level pre-filter (cheap, indexed); the exact LIVE/SCHEDULED/
    // EXPIRED distinction still requires computeAvailability() below since it depends on "now"
    // vs. startDate/endDate, which isn't expressible as a static Prisma where-clause.
    const campaigns = await this.prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { offer: { select: OFFER_SUMMARY_SELECT }, _count: { select: { creatorCampaigns: { where: { status: "ACTIVE" } } } } },
    });

    // Only LIVE campaigns are ever shown in the catalog — computed server-side, not left to the
    // frontend (see RBAC.md / "Do not rely on frontend filtering for security").
    const live = campaigns.filter((c) => this.computeAvailability(c, now) === "LIVE");
    const mediaByCampaignId = await this.campaignMedia.listCreatorSafeForCampaigns(live.map((c) => c.id));
    return Promise.all(live.map((c) => this.toCreatorResponse(c as CampaignWithRelations, mediaByCampaignId.get(c.id))));
  }

  async findOneForCreatorOrThrow(id: string): Promise<CampaignCreatorResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { offer: { select: OFFER_SUMMARY_SELECT }, _count: { select: { creatorCampaigns: { where: { status: "ACTIVE" } } } } },
    });
    if (!campaign || this.computeAvailability(campaign) !== "LIVE") {
      // Deliberately the same NOT_FOUND a nonexistent id would get — a paused/archived/future
      // campaign must be indistinguishable from one that never existed to a creator guessing ids.
      throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");
    }
    return this.toCreatorResponse(campaign);
  }
}
