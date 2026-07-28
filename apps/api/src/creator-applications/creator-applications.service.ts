import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type CampaignApplication, type CampaignApplicationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { ReferralsService } from "../referrals/referrals.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import type { CreateApplicationDto } from "./dto/create-application.dto";
import type { ApplicationQueryDto } from "./dto/application-query.dto";

const CREATOR_SUMMARY_SELECT = { id: true, displayName: true, city: true } satisfies Prisma.CreatorProfileSelect;
const CAMPAIGN_SUMMARY_SELECT = { id: true, name: true, slug: true, category: true, creatorLimit: true, status: true } satisfies Prisma.CampaignSelect;
const MY_CAMPAIGN_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  ctaLabel: true,
  commissionType: true,
  commissionRateBps: true,
  commissionAmountMinor: true,
  commissionCurrency: true,
  offer: { select: { id: true, name: true, slug: true, priceMinor: true, compareAtPriceMinor: true, currency: true } },
} satisfies Prisma.CampaignSelect;

// The merged/synthesized view docs/SCHEMA_API_AUDIT.md mandates for GET /creator/my-campaigns —
// collapses CampaignApplication.status + (once approved) CreatorCampaign.status into the single
// frontend-facing CreatorCampaignStatus union, so neither Prisma enum leaks directly.
export interface MyCampaignResponse {
  id: string;
  campaignId: string;
  status: string;
  joinedAt: Date;
  rejectionReason: string | null;
  campaign: unknown;
}

type ApplicationWithRelations = CampaignApplication & {
  creator: { id: string; displayName: string; city: string | null };
  campaign: { id: string; name: string; slug: string; category: string; creatorLimit: number | null; status: string };
};

export interface ApplicationAdminResponse extends CampaignApplication {
  creator: { id: string; displayName: string; city: string | null };
  campaign: { id: string; name: string; slug: string; category: string };
}

// Creator-safe shape — never adminNotes/reviewedById (admin identity is not the creator's
// business), matching the Offer/Landing/Campaign creator-response convention.
export interface ApplicationCreatorResponse {
  id: string;
  campaignId: string;
  status: CampaignApplicationStatus;
  message: string | null;
  platform: string | null;
  contentFormat: string | null;
  portfolioLinks: string[];
  sampleContentLinks: string[];
  answers: Prisma.JsonValue;
  followerSnapshot: number | null;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  campaign: { id: string; name: string; slug: string; category: string };
}

// Explicit per-action allowed source-states — not a single generic "transition(to)" matrix, since
// submit/resubmit both land on SUBMITTED from different source states and are distinct creator
// actions (see DECISIONS.md ADR-012).
const SUBMIT_FROM: CampaignApplicationStatus[] = ["DRAFT"];
const RESUBMIT_FROM: CampaignApplicationStatus[] = ["CHANGES_REQUESTED"];
const WITHDRAW_FROM: CampaignApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"];
const EDIT_DRAFT_FROM: CampaignApplicationStatus[] = ["DRAFT", "CHANGES_REQUESTED"];
const START_REVIEW_FROM: CampaignApplicationStatus[] = ["SUBMITTED"];
const DECIDE_FROM: CampaignApplicationStatus[] = ["UNDER_REVIEW"];

@Injectable()
export class CreatorApplicationsService {
  constructor(
    private prisma: PrismaService,
    private campaigns: CampaignsService,
    private referrals: ReferralsService,
    private events: EventEmitter2,
  ) {}

  private toAdminResponse(app: ApplicationWithRelations): ApplicationAdminResponse {
    return {
      ...app,
      creator: app.creator,
      campaign: { id: app.campaign.id, name: app.campaign.name, slug: app.campaign.slug, category: app.campaign.category },
    };
  }

  private toCreatorResponse(app: ApplicationWithRelations): ApplicationCreatorResponse {
    return {
      id: app.id,
      campaignId: app.campaignId,
      status: app.status,
      message: app.message,
      platform: app.platform,
      contentFormat: app.contentFormat,
      portfolioLinks: app.portfolioLinks,
      sampleContentLinks: app.sampleContentLinks,
      answers: app.answers,
      followerSnapshot: app.followerSnapshot,
      rejectionReason: app.rejectionReason,
      changesRequestedReason: app.changesRequestedReason,
      submittedAt: app.submittedAt,
      reviewedAt: app.reviewedAt,
      approvedAt: app.approvedAt,
      rejectedAt: app.rejectedAt,
      withdrawnAt: app.withdrawnAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      campaign: { id: app.campaign.id, name: app.campaign.name, slug: app.campaign.slug, category: app.campaign.category },
    };
  }

  // ---- Creator-facing ----

  async listMine(creatorId: string): Promise<ApplicationCreatorResponse[]> {
    const apps = await this.prisma.campaignApplication.findMany({
      where: { creatorId, status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
      include: { creator: { select: CREATOR_SUMMARY_SELECT }, campaign: { select: CAMPAIGN_SUMMARY_SELECT } },
    });
    return apps.map((a) => this.toCreatorResponse(a as ApplicationWithRelations));
  }

  private async findOwnedOrThrow(id: string, creatorId: string): Promise<ApplicationWithRelations> {
    const app = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: { creator: { select: CREATOR_SUMMARY_SELECT }, campaign: { select: CAMPAIGN_SUMMARY_SELECT } },
    });
    // Same NOT_FOUND for "doesn't exist" and "belongs to someone else" — ownership can never be
    // probed by guessing ids (same pattern as Campaign's creator-visibility gating).
    if (!app || app.creatorId !== creatorId) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    return app;
  }

  async findMineOrThrow(id: string, creatorId: string): Promise<ApplicationCreatorResponse> {
    return this.toCreatorResponse(await this.findOwnedOrThrow(id, creatorId));
  }

  private async assertEligibleToApply(campaignId: string, creatorId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");

    const availability = this.campaigns.computeAvailability(campaign);
    if (availability !== "LIVE") {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Bu kampaniya hozircha ariza qabul qilmayapti.", { reason: "CAMPAIGN_NOT_LIVE" });
    }

    const approvedCount = await this.prisma.creatorCampaign.count({ where: { campaignId, status: "ACTIVE" } });
    const applicationAvailability = this.campaigns.computeApplicationAvailability(campaign, approvedCount);
    if (applicationAvailability === "FULL") {
      throw new DomainException("CAMPAIGN_FULL", "Kampaniya uchun creator limiti to'lgan.");
    }
    if (applicationAvailability !== "OPEN") {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Kampaniyaga ariza topshirish oynasi ochiq emas.", {
        reason: applicationAvailability,
      });
    }

    const creator = await this.prisma.creatorProfile.findUnique({ where: { id: creatorId }, include: { user: true, socialAccounts: true } });
    if (!creator) throw new DomainException("NOT_FOUND", "Creator profili topilmadi.");
    if (creator.user.status !== "ACTIVE") {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Creator hisobi faol emas.", { reason: "ACCOUNT_INACTIVE" });
    }

    const maxFollowers = creator.socialAccounts.reduce((max, a) => Math.max(max, a.followerCount), 0);
    if (campaign.minFollowers != null && maxFollowers < campaign.minFollowers) {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Obunachilar soni talab qilingan minimal darajadan kam.", {
        reason: "BELOW_MIN_FOLLOWERS",
      });
    }
    if (campaign.maxFollowers != null && maxFollowers > campaign.maxFollowers) {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Obunachilar soni ruxsat etilgan maksimaldan ko'p.", {
        reason: "ABOVE_MAX_FOLLOWERS",
      });
    }
  }

  private assertPlatformMatches(platform: string | undefined, campaignPlatforms: string[]): void {
    if (platform && campaignPlatforms.length > 0 && !campaignPlatforms.includes(platform)) {
      throw new DomainException("APPLICATION_NOT_ELIGIBLE", "Tanlangan platforma ushbu kampaniya talablariga mos kelmaydi.", {
        reason: "PLATFORM_MISMATCH",
      });
    }
  }

  async create(campaignId: string, creatorId: string, dto: CreateApplicationDto): Promise<ApplicationCreatorResponse> {
    const existing = await this.prisma.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId } } });
    if (existing) throw new DomainException("ALREADY_APPLIED", "Siz bu kampaniyaga allaqachon ariza topshirgansiz.");

    await this.assertEligibleToApply(campaignId, creatorId);
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    this.assertPlatformMatches(dto.platform, campaign.platforms);

    const creator = await this.prisma.creatorProfile.findUnique({ where: { id: creatorId }, include: { socialAccounts: true } });
    const followerSnapshot = creator ? creator.socialAccounts.reduce((max, a) => Math.max(max, a.followerCount), 0) : null;

    const created = await this.prisma.campaignApplication.create({
      data: {
        campaignId,
        creatorId,
        status: "DRAFT",
        message: dto.message,
        platform: dto.platform,
        contentFormat: dto.contentFormat,
        portfolioLinks: dto.portfolioLinks ?? [],
        sampleContentLinks: dto.sampleContentLinks ?? [],
        answers: dto.answers as Prisma.InputJsonValue | undefined,
        followerSnapshot,
      },
    });
    return this.findMineOrThrow(created.id, creatorId);
  }

  async updateDraft(id: string, creatorId: string, dto: CreateApplicationDto): Promise<ApplicationCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!EDIT_DRAFT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Bu holatdagi arizani tahrirlab bo'lmaydi.", {
        from: existing.status,
      });
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: {
        message: dto.message,
        platform: dto.platform,
        contentFormat: dto.contentFormat,
        portfolioLinks: dto.portfolioLinks,
        sampleContentLinks: dto.sampleContentLinks,
        answers: dto.answers as Prisma.InputJsonValue | undefined,
      },
    });
    return this.findMineOrThrow(id, creatorId);
  }

  private async assertSubmittable(app: ApplicationWithRelations): Promise<void> {
    await this.assertEligibleToApply(app.campaignId, app.creatorId);
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: app.campaignId } });
    this.assertPlatformMatches(app.platform ?? undefined, campaign.platforms);
  }

  // Campaigns with requiresApproval === false skip UNDER_REVIEW entirely and approve instantly on
  // submit — this is an existing Campaign-domain business rule the catalog UI already promises
  // ("Darhol qo'shilish" / instant join) and the mock has always implemented; without this check
  // here, real-mode submissions would incorrectly sit in SUBMITTED forever for those campaigns.
  private async submitOrInstantApprove(
    id: string,
    creatorId: string,
    existing: ApplicationWithRelations,
    fromStatuses: CampaignApplicationStatus[],
    transitionErrorMessage: string,
  ): Promise<ApplicationCreatorResponse> {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: existing.campaignId } });
    if (campaign.requiresApproval) {
      await this.prisma.campaignApplication.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
    } else {
      await this.approveCapacitySafe(id, null, fromStatuses, transitionErrorMessage);
      // Instant-join campaigns skip SUBMITTED entirely, so this is also this creator's first
      // *approved* application — fire both referral milestone hooks (see referrals.service.ts).
      await this.referrals.onCampaignApplicationApproved(creatorId, id);
      // emitAsync, not emit — EventEmitter2's plain .emit() is fire-and-forget and does not await
      // async @OnEvent listeners, so a caller returning immediately after (and a test asserting
      // the resulting notification right after) races the listener's own DB writes. emitAsync
      // resolves only once every listener (including NotificationEventsListener's async handler)
      // has completed, closing that race without giving up the emit-based decoupling itself.
      await this.events.emitAsync(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_APPROVED, {
        applicationId: id,
        creatorId,
        creatorName: existing.creator.displayName,
        campaignName: existing.campaign.name,
      });
    }
    // "Applies to a Campaign" (referral spec's business flow step) — the first-ever submission,
    // regardless of whether it required review or was instant-approved.
    await this.referrals.onCampaignApplicationSubmitted(creatorId);
    await this.events.emitAsync(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_SUBMITTED, {
      applicationId: id,
      creatorId,
      creatorName: existing.creator.displayName,
      campaignName: existing.campaign.name,
    });
    return this.findMineOrThrow(id, creatorId);
  }

  async submit(id: string, creatorId: string): Promise<ApplicationCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!SUBMIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Faqat qoralama arizani yuborish mumkin.", { from: existing.status });
    }
    await this.assertSubmittable(existing);
    return this.submitOrInstantApprove(id, creatorId, existing, SUBMIT_FROM, "Faqat qoralama arizani yuborish mumkin.");
  }

  async resubmit(id: string, creatorId: string): Promise<ApplicationCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!RESUBMIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Faqat o'zgartirish so'ralgan arizani qayta yuborish mumkin.", {
        from: existing.status,
      });
    }
    await this.assertSubmittable(existing);
    return this.submitOrInstantApprove(
      id,
      creatorId,
      existing,
      RESUBMIT_FROM,
      "Faqat o'zgartirish so'ralgan arizani qayta yuborish mumkin.",
    );
  }

  async withdraw(id: string, creatorId: string): Promise<ApplicationCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!WITHDRAW_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Bu holatdagi arizani bekor qilib bo'lmaydi.", { from: existing.status });
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    return this.findMineOrThrow(id, creatorId);
  }

  // Not gated on "campaign still LIVE" — unlike the public catalog, once a creator has a real
  // application/membership against a campaign, it must keep showing here regardless of whether
  // the campaign later gets paused/completed (see CampaignsService.findOneForCreatorOrThrow's
  // stricter LIVE-only gate, which is deliberately NOT reused here).
  async listMyCampaigns(creatorId: string): Promise<MyCampaignResponse[]> {
    const apps = await this.prisma.campaignApplication.findMany({
      where: { creatorId, status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: MY_CAMPAIGN_SUMMARY_SELECT } },
    });

    const membershipByCampaignId = new Map(
      (
        await this.prisma.creatorCampaign.findMany({
          where: { creatorId, campaignId: { in: apps.map((a) => a.campaignId) } },
        })
      ).map((m) => [m.campaignId, m]),
    );

    return apps.map((a) => {
      const membership = membershipByCampaignId.get(a.campaignId);
      let status: string;
      if (membership) {
        status = membership.status === "ACTIVE" ? "ACTIVE" : membership.status === "ENDED" ? "COMPLETED" : "ACTIVE";
      } else {
        status =
          a.status === "SUBMITTED"
            ? "APPLIED"
            : a.status === "UNDER_REVIEW"
              ? "UNDER_REVIEW"
              : a.status === "CHANGES_REQUESTED"
                ? "CHANGES_REQUESTED"
                : a.status === "REJECTED"
                  ? "REJECTED"
                  : a.status === "WITHDRAWN"
                    ? "CANCELLED"
                    : "APPROVED";
      }
      return {
        id: a.id,
        campaignId: a.campaignId,
        status,
        joinedAt: a.submittedAt ?? a.createdAt,
        rejectionReason: a.rejectionReason,
        campaign: a.campaign,
      };
    });
  }

  // ---- Admin-facing ----

  async list(query: ApplicationQueryDto): Promise<PaginatedResult<ApplicationAdminResponse>> {
    const where: Prisma.CampaignApplicationWhereInput = {
      status: query.status,
      campaignId: query.campaignId,
      creatorId: query.creatorId,
      platform: query.platform,
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { creator: { displayName: { contains: query.search, mode: "insensitive" } } },
              { campaign: { name: { contains: query.search, mode: "insensitive" } } },
              { campaign: { internalName: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "submittedAt", "reviewedAt", "status"]);
    const orderBy: Prisma.CampaignApplicationOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.campaignApplication.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
        include: { creator: { select: CREATOR_SUMMARY_SELECT }, campaign: { select: CAMPAIGN_SUMMARY_SELECT } },
      }),
      this.prisma.campaignApplication.count({ where }),
    ]);

    return paginate(items.map((a) => this.toAdminResponse(a as ApplicationWithRelations)), total, query);
  }

  async findOneOrThrow(id: string): Promise<ApplicationAdminResponse> {
    const app = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: { creator: { select: CREATOR_SUMMARY_SELECT }, campaign: { select: CAMPAIGN_SUMMARY_SELECT } },
    });
    if (!app) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    return this.toAdminResponse(app);
  }

  async startReview(id: string, actorId: string | null): Promise<ApplicationAdminResponse> {
    const existing = await this.prisma.campaignApplication.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    if (!START_REVIEW_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Faqat yuborilgan arizani ko'rib chiqishni boshlash mumkin.", {
        from: existing.status,
      });
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: { status: "UNDER_REVIEW", reviewedAt: new Date(), reviewedById: actorId },
    });
    return this.findOneOrThrow(id);
  }

  async reject(id: string, actorId: string | null, reason: string): Promise<ApplicationAdminResponse> {
    const existing = await this.prisma.campaignApplication.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Faqat ko'rib chiqilayotgan arizani rad etish mumkin.", {
        from: existing.status,
      });
    }
    const now = new Date();
    await this.prisma.campaignApplication.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason, rejectedAt: now, reviewedAt: now, reviewedById: actorId },
    });
    const result = await this.findOneOrThrow(id);
    await this.events.emitAsync(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_REJECTED, {
      applicationId: id,
      creatorId: result.creator.id,
      creatorName: result.creator.displayName,
      campaignName: result.campaign.name,
      reason,
    });
    return result;
  }

  async requestChanges(id: string, actorId: string | null, reason: string): Promise<ApplicationAdminResponse> {
    const existing = await this.prisma.campaignApplication.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_APPLICATION_TRANSITION", "Faqat ko'rib chiqilayotgan arizadan o'zgartirish so'ralishi mumkin.", {
        from: existing.status,
      });
    }
    await this.prisma.campaignApplication.update({
      where: { id },
      data: { status: "CHANGES_REQUESTED", changesRequestedReason: reason, reviewedAt: new Date(), reviewedById: actorId },
    });
    return this.findOneOrThrow(id);
  }

  // Capacity-safe: SERIALIZABLE isolation makes Postgres abort one of two concurrent approvals
  // that would both push the campaign over capacity (Postgres SQLSTATE 40001); that's caught and
  // surfaced as a typed CAMPAIGN_FULL rather than a raw 500, with a single retry first in case the
  // conflict was with an unrelated concurrent write rather than a real over-capacity race. Shared
  // by the admin approve() action and the creator-side instant-join path (submit/resubmit on a
  // campaign with requiresApproval === false).
  //
  // BUG FIX (found by a real-concurrency integration test, not a guess): with this project's
  // driver-adapter setup (@prisma/adapter-pg), a commit-time serialization conflict does NOT come
  // through as a Prisma.PrismaClientKnownRequestError with code "P2034" — it surfaces as a raw
  // DriverAdapterError (name === "DriverAdapterError", cause.kind === "TransactionWriteConflict")
  // that bypasses Prisma's usual error normalization. Checking only for P2034 let a real
  // concurrent-approval race fall through as an unhandled 500 instead of the typed CAMPAIGN_FULL
  // the spec requires. Both shapes are checked so this also keeps working if a future Prisma
  // version normalizes it back into a PrismaClientKnownRequestError.
  private isSerializationConflict(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") return true;
    if (err instanceof Error && err.name === "DriverAdapterError") {
      const cause = (err as { cause?: { kind?: string } }).cause;
      if (cause?.kind === "TransactionWriteConflict") return true;
    }
    return false;
  }
  private async approveCapacitySafe(
    id: string,
    actorId: string | null,
    fromStatuses: CampaignApplicationStatus[],
    transitionErrorMessage: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.campaignApplication.findUnique({ where: { id }, include: { campaign: true } });
            if (!existing) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
            if (!fromStatuses.includes(existing.status)) {
              throw new DomainException("INVALID_APPLICATION_TRANSITION", transitionErrorMessage, { from: existing.status });
            }
            const approvedCount = await tx.creatorCampaign.count({ where: { campaignId: existing.campaignId, status: "ACTIVE" } });
            if (existing.campaign.creatorLimit != null && approvedCount >= existing.campaign.creatorLimit) {
              throw new DomainException("CAMPAIGN_FULL", "Kampaniya uchun creator limiti to'lgan.");
            }
            const now = new Date();
            await tx.campaignApplication.update({
              where: { id },
              data: {
                status: "APPROVED",
                approvedAt: now,
                submittedAt: existing.submittedAt ?? now,
                reviewedAt: now,
                reviewedById: actorId,
              },
            });
            await tx.creatorCampaign.create({ data: { campaignId: existing.campaignId, creatorId: existing.creatorId, status: "ACTIVE" } });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return;
      } catch (err) {
        const isSerializationConflict = this.isSerializationConflict(err);
        if (!isSerializationConflict || attempt === 1) {
          if (isSerializationConflict) throw new DomainException("CAMPAIGN_FULL", "Kampaniya uchun creator limiti to'lgan.");
          throw err;
        }
        // one retry — the conflict may have been with an unrelated concurrent write, not a real
        // over-capacity race; the second pass re-reads the true current count either way.
      }
    }
    throw new DomainException("CAMPAIGN_FULL", "Kampaniya uchun creator limiti to'lgan.");
  }

  async approve(id: string, actorId: string | null): Promise<ApplicationAdminResponse> {
    await this.approveCapacitySafe(id, actorId, DECIDE_FROM, "Faqat ko'rib chiqilayotgan arizani tasdiqlash mumkin.");
    const result = await this.findOneOrThrow(id);
    await this.referrals.onCampaignApplicationApproved(result.creatorId, id);
    // The listener fans this single event out to both the "application approved" and "campaign
    // joined" notification types — see NotificationEventsListener.onCampaignApplicationApproved.
    await this.events.emitAsync(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_APPROVED, {
      applicationId: id,
      creatorId: result.creatorId,
      creatorName: result.creator.displayName,
      campaignName: result.campaign.name,
    });
    return result;
  }
}
