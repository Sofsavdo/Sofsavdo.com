import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Competition, CompetitionParticipantStatus, CompetitionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { PaginationQueryDto, paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { rankCreatorsByCommission, rankCreatorsByOrderCount, rankCreatorsByReferralCount, type RankedCreator } from "../creator-leaderboard/rank-creators-by-commission.util";
import { INSTAGRAM_VIEWS_PORT, type InstagramViewsPort } from "./instagram-views.port";
import type { CreateCompetitionDto } from "./dto/create-competition.dto";
import type { UpdateCompetitionDto } from "./dto/update-competition.dto";

export type CompetitionAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";

const ALLOWED_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export interface CompetitionResponse {
  id: string;
  name: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: CompetitionStatus;
  availability: CompetitionAvailability;
  metric: string;
  firstPrize: string;
  secondPrize: string;
  thirdPrize: string;
  imageUrl: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorCompetitionResponse {
  id: string;
  name: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  availability: CompetitionAvailability;
  metric: string;
  prizeDescription: string | null;
  // Replaces the old plain `hasJoined: boolean` — an INSTAGRAM_VIEWS competition needs to
  // distinguish "not entered" from "video submitted, awaiting review" from "rejected, can
  // resubmit" from "approved, showing in the leaderboard". Every other metric only ever produces
  // APPROVED (see join()'s unconditional-approve default) or null, so this is backward compatible.
  myParticipant: { status: CompetitionParticipantStatus; videoUrl: string | null; reviewNote: string | null } | null;
}

export interface CompetitionParticipantAdminResponse {
  id: string;
  creatorId: string;
  creatorName: string;
  status: CompetitionParticipantStatus;
  videoUrl: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  viewCount: number;
  viewCountUpdatedAt: Date | null;
  viewCountSource: string | null;
  joinedAt: Date;
}

export interface CompetitionLeaderboardEntry extends RankedCreator {
  rank: number;
}

export interface CompetitionLeaderboardResponse {
  competitionId: string;
  top: CompetitionLeaderboardEntry[];
  me: CompetitionLeaderboardEntry | null;
}

const LEADERBOARD_TOP_N = 20;
// Shorter than the platform monthly leaderboard's 60s — a Competition's window is often much
// shorter than a month (e.g. a one-week contest), so staleness matters proportionally more near
// its close. Still a real win under load: every creator viewing this one competition shares one
// cache entry.
const LEADERBOARD_CACHE_TTL_SECONDS = 30;

@Injectable()
export class CompetitionsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
    private audit: AuditService,
    private events: EventEmitter2,
    @Inject(INSTAGRAM_VIEWS_PORT) private instagramViews: InstagramViewsPort,
  ) {}

  // Mirrors OffersService/CampaignsService's own computeAvailability exactly — stored `status`
  // (admin-driven) vs. computed `availability` (date-derived, never persisted) stay separate
  // concepts, same reasoning as everywhere else this split is used in this codebase.
  computeAvailability(competition: Pick<Competition, "status" | "startAt" | "endAt">, now: Date = new Date()): CompetitionAvailability {
    if (competition.status !== "ACTIVE") return "INACTIVE";
    if (competition.startAt > now) return "SCHEDULED";
    if (competition.endAt < now) return "EXPIRED";
    return "LIVE";
  }

  private toResponse(competition: Competition): CompetitionResponse {
    return {
      id: competition.id,
      name: competition.name,
      description: competition.description,
      startAt: competition.startAt,
      endAt: competition.endAt,
      status: competition.status,
      availability: this.computeAvailability(competition),
      metric: competition.metric,
      firstPrize: competition.firstPrize,
      secondPrize: competition.secondPrize,
      thirdPrize: competition.thirdPrize,
      imageUrl: competition.imageUrl,
      archivedAt: competition.archivedAt,
      createdAt: competition.createdAt,
      updatedAt: competition.updatedAt,
    };
  }

  private assertDatesConsistent(startAt: Date, endAt: Date): void {
    if (startAt >= endAt) {
      throw new DomainException("VALIDATION_ERROR", "Boshlanish sanasi tugash sanasidan oldin bo'lishi kerak.", { field: "startAt" });
    }
  }

  // ---- Admin ----

  async create(dto: CreateCompetitionDto, actorUserId: string | null): Promise<CompetitionResponse> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertDatesConsistent(startAt, endAt);

    const competition = await this.prisma.competition.create({
      data: {
        name: dto.name,
        description: dto.description,
        startAt,
        endAt,
        metric: dto.metric,
        firstPrize: dto.firstPrize,
        secondPrize: dto.secondPrize,
        thirdPrize: dto.thirdPrize,
        imageUrl: dto.imageUrl,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
    return this.toResponse(competition);
  }

  async findOneOrThrow(id: string): Promise<CompetitionResponse> {
    const competition = await this.prisma.competition.findUnique({ where: { id } });
    if (!competition) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");
    return this.toResponse(competition);
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResult<CompetitionResponse>> {
    const [rows, total] = await Promise.all([
      this.prisma.competition.findMany({ orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.competition.count(),
    ]);
    return paginate(rows.map((r) => this.toResponse(r)), total, query);
  }

  async update(id: string, dto: UpdateCompetitionDto, actorUserId: string | null): Promise<CompetitionResponse> {
    const existing = await this.prisma.competition.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");
    if (existing.status === "ARCHIVED") {
      throw new DomainException("INVALID_COMPETITION_TRANSITION", "Arxivlangan musobaqani tahrirlab bo'lmaydi.");
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;
    this.assertDatesConsistent(startAt, endAt);

    const competition = await this.prisma.competition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startAt,
        endAt,
        metric: dto.metric,
        firstPrize: dto.firstPrize,
        secondPrize: dto.secondPrize,
        thirdPrize: dto.thirdPrize,
        imageUrl: dto.imageUrl,
        updatedById: actorUserId,
      },
    });
    return this.toResponse(competition);
  }

  private async transition(id: string, to: CompetitionStatus, actorUserId: string | null): Promise<CompetitionResponse> {
    const existing = await this.prisma.competition.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");
    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(to)) {
      throw new DomainException("INVALID_COMPETITION_TRANSITION", `${existing.status} holatidan ${to} holatiga o'tib bo'lmaydi.`, {
        from: existing.status,
        to,
      });
    }
    const competition = await this.prisma.competition.update({
      where: { id },
      data: { status: to, updatedById: actorUserId, archivedAt: to === "ARCHIVED" ? new Date() : undefined },
    });
    return this.toResponse(competition);
  }

  publish(id: string, actorUserId: string | null): Promise<CompetitionResponse> {
    return this.transition(id, "ACTIVE", actorUserId);
  }

  complete(id: string, actorUserId: string | null): Promise<CompetitionResponse> {
    return this.transition(id, "COMPLETED", actorUserId);
  }

  archive(id: string, actorUserId: string | null): Promise<CompetitionResponse> {
    return this.transition(id, "ARCHIVED", actorUserId);
  }

  // ---- Creator-facing ----

  // LIVE (ongoing, so a creator can act on it now) and SCHEDULED (upcoming, so they know to
  // prepare) — never EXPIRED/INACTIVE/DRAFT, matching the same "never show what a buyer/creator
  // shouldn't act on" convention as OffersService.listFeaturedPublic.
  async listActiveForCreators(creatorId?: string): Promise<CreatorCompetitionResponse[]> {
    const rows = await this.prisma.competition.findMany({ where: { status: "ACTIVE" }, orderBy: { startAt: "asc" } });
    const filtered = rows.map((r) => this.toResponse(r)).filter((r) => r.availability === "LIVE" || r.availability === "SCHEDULED");

    // Check join/participant status for each competition if creatorId is provided
    const result = await Promise.all(
      filtered.map(async (r) => {
        let myParticipant: CreatorCompetitionResponse["myParticipant"] = null;
        if (creatorId) {
          const participant = await this.prisma.competitionParticipant.findUnique({
            where: { competitionId_creatorId: { competitionId: r.id, creatorId } },
          });
          myParticipant = participant ? { status: participant.status, videoUrl: participant.videoUrl, reviewNote: participant.reviewNote } : null;
        }

        // Build prize description from individual prizes
        const prizeParts = [r.firstPrize, r.secondPrize, r.thirdPrize].filter(Boolean);
        const prizeDescription = prizeParts.length > 0 ? prizeParts.join(", ") : null;

        return {
          id: r.id,
          name: r.name,
          description: r.description,
          startAt: r.startAt,
          endAt: r.endAt,
          availability: r.availability,
          metric: r.metric,
          prizeDescription,
          myParticipant,
        };
      }),
    );

    return result;
  }

  private assertLiveAndJoinable(competition: Competition): void {
    if (competition.status !== "ACTIVE") {
      throw new DomainException("VALIDATION_ERROR", "Faqat faol musobaqalarga qo'shilish mumkin.");
    }
    if (this.computeAvailability(competition) !== "LIVE") {
      throw new DomainException("VALIDATION_ERROR", "Musobaqa hali boshlanmagan yoki tugagan.");
    }
  }

  async join(competitionId: string, creatorId: string): Promise<{ joined: boolean }> {
    const competition = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");
    if (competition.metric === "INSTAGRAM_VIEWS") {
      throw new DomainException("VALIDATION_ERROR", "Bu musobaqa uchun video havola bilan ariza topshirish kerak.");
    }
    this.assertLiveAndJoinable(competition);

    // Check if already joined
    const existing = await this.prisma.competitionParticipant.findUnique({
      where: { competitionId_creatorId: { competitionId, creatorId } },
    });
    if (existing) return { joined: false };

    // Join the competition — status defaults to APPROVED (see schema), unconditional for every
    // metric except INSTAGRAM_VIEWS, which never reaches here (see the guard above).
    await this.prisma.competitionParticipant.create({
      data: { competitionId, creatorId },
    });

    return { joined: true };
  }

  // ---- Video-submission entries (metric === "INSTAGRAM_VIEWS") ----

  async submitVideoEntry(competitionId: string, creatorId: string, videoUrl: string): Promise<CreatorCompetitionResponse["myParticipant"]> {
    const competition = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");
    if (competition.metric !== "INSTAGRAM_VIEWS") {
      throw new DomainException("VALIDATION_ERROR", "Bu musobaqa video havola talab qilmaydi — oddiy qo'shilish orqali ishtirok eting.");
    }
    this.assertLiveAndJoinable(competition);

    const existing = await this.prisma.competitionParticipant.findUnique({
      where: { competitionId_creatorId: { competitionId, creatorId } },
    });
    if (existing && existing.status !== "REJECTED") {
      throw new DomainException("ALREADY_APPLIED", "Siz bu musobaqaga allaqachon video yubordingiz.");
    }

    const creator = await this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { displayName: true } });

    // A REJECTED participant resubmitting reuses the same row (the competitionId+creatorId unique
    // constraint forbids a second one) — clears the prior reviewNote/reviewedAt so the creator's
    // own status view doesn't show a stale rejection reason next to a brand-new PENDING submission.
    const participant = existing
      ? await this.prisma.competitionParticipant.update({
          where: { id: existing.id },
          data: { videoUrl, status: "PENDING", reviewNote: null, reviewedAt: null, reviewedById: null },
        })
      : await this.prisma.competitionParticipant.create({
          data: { competitionId, creatorId, videoUrl, status: "PENDING" },
        });

    await this.events.emitAsync(NOTIFICATION_EVENTS.COMPETITION_SUBMISSION_NEW, {
      participantId: participant.id,
      competitionId,
      competitionName: competition.name,
      creatorId,
      creatorName: creator.displayName,
    });

    return { status: participant.status, videoUrl: participant.videoUrl, reviewNote: participant.reviewNote };
  }

  // ---- Admin: participant review (INSTAGRAM_VIEWS competitions) ----

  async listParticipants(competitionId: string): Promise<CompetitionParticipantAdminResponse[]> {
    const rows = await this.prisma.competitionParticipant.findMany({
      where: { competitionId },
      include: { creator: { select: { displayName: true } } },
      orderBy: [{ status: "asc" }, { viewCount: "desc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      creatorId: p.creatorId,
      creatorName: p.creator.displayName,
      status: p.status,
      videoUrl: p.videoUrl,
      reviewNote: p.reviewNote,
      reviewedAt: p.reviewedAt,
      viewCount: p.viewCount,
      viewCountUpdatedAt: p.viewCountUpdatedAt,
      viewCountSource: p.viewCountSource,
      joinedAt: p.joinedAt,
    }));
  }

  private async findParticipantOrThrow(participantId: string) {
    const participant = await this.prisma.competitionParticipant.findUnique({
      where: { id: participantId },
      include: { competition: true },
    });
    if (!participant) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    return participant;
  }

  async approveParticipant(participantId: string, actorUserId: string | null): Promise<CompetitionParticipantAdminResponse> {
    const participant = await this.findParticipantOrThrow(participantId);
    if (participant.status !== "PENDING") {
      throw new DomainException("INVALID_STATE", "Faqat ko'rib chiqilayotgan arizani tasdiqlash mumkin.", { from: participant.status });
    }

    const updated = await this.prisma.competitionParticipant.update({
      where: { id: participantId },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: actorUserId },
      include: { creator: { select: { displayName: true } } },
    });

    await this.audit.record({
      actorId: actorUserId,
      action: "COMPETITION_SUBMISSION_APPROVED",
      entityType: "CompetitionParticipant",
      entityId: participantId,
      before: { status: "PENDING" },
      after: { status: "APPROVED" },
    });
    await this.events.emitAsync(NOTIFICATION_EVENTS.COMPETITION_SUBMISSION_APPROVED, {
      competitionId: participant.competitionId,
      competitionName: participant.competition.name,
      creatorId: participant.creatorId,
    });

    return {
      id: updated.id,
      creatorId: updated.creatorId,
      creatorName: updated.creator.displayName,
      status: updated.status,
      videoUrl: updated.videoUrl,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt,
      viewCount: updated.viewCount,
      viewCountUpdatedAt: updated.viewCountUpdatedAt,
      viewCountSource: updated.viewCountSource,
      joinedAt: updated.joinedAt,
    };
  }

  async rejectParticipant(participantId: string, reason: string, actorUserId: string | null): Promise<CompetitionParticipantAdminResponse> {
    const participant = await this.findParticipantOrThrow(participantId);
    if (participant.status !== "PENDING") {
      throw new DomainException("INVALID_STATE", "Faqat ko'rib chiqilayotgan arizani rad etish mumkin.", { from: participant.status });
    }

    const reviewedAt = new Date();
    const updated = await this.prisma.competitionParticipant.update({
      where: { id: participantId },
      data: { status: "REJECTED", reviewNote: reason, reviewedAt, reviewedById: actorUserId },
      include: { creator: { select: { displayName: true } } },
    });

    await this.audit.record({
      actorId: actorUserId,
      action: "COMPETITION_SUBMISSION_REJECTED",
      entityType: "CompetitionParticipant",
      entityId: participantId,
      before: { status: "PENDING" },
      after: { status: "REJECTED", reason },
    });
    await this.events.emitAsync(NOTIFICATION_EVENTS.COMPETITION_SUBMISSION_REJECTED, {
      competitionId: participant.competitionId,
      competitionName: participant.competition.name,
      creatorId: participant.creatorId,
      reason,
      decidedAt: reviewedAt.toISOString(),
    });

    return {
      id: updated.id,
      creatorId: updated.creatorId,
      creatorName: updated.creator.displayName,
      status: updated.status,
      videoUrl: updated.videoUrl,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt,
      viewCount: updated.viewCount,
      viewCountUpdatedAt: updated.viewCountUpdatedAt,
      viewCountSource: updated.viewCountSource,
      joinedAt: updated.joinedAt,
    };
  }

  // Admin-triggered, one participant at a time — never a background poller. Best-effort (see
  // InstagramViewsScraperAdapter's own comment): a failed fetch throws so the admin sees why and
  // can fall back to updateViewCount's manual entry, never silently leaves the count stale without
  // saying so.
  async refreshViewCount(participantId: string, actorUserId: string | null): Promise<CompetitionParticipantAdminResponse> {
    const participant = await this.findParticipantOrThrow(participantId);
    if (participant.status !== "APPROVED") {
      throw new DomainException("INVALID_STATE", "Faqat tasdiqlangan ishtirokchining ko'rishlar sonini yangilash mumkin.", { from: participant.status });
    }
    if (!participant.videoUrl) {
      throw new DomainException("VALIDATION_ERROR", "Bu ishtirokchida video havola yo'q.");
    }

    const result = await this.instagramViews.fetchViewCount(participant.videoUrl);
    if (!result.ok || result.viewCount === undefined) {
      throw new DomainException("INSTAGRAM_FETCH_FAILED", result.errorMessage ?? "Ko'rishlar sonini olib bo'lmadi.");
    }

    const updated = await this.prisma.competitionParticipant.update({
      where: { id: participantId },
      data: { viewCount: result.viewCount, viewCountUpdatedAt: new Date(), viewCountSource: "AUTO" },
      include: { creator: { select: { displayName: true } } },
    });

    await this.audit.record({
      actorId: actorUserId,
      action: "COMPETITION_VIEW_COUNT_REFRESHED",
      entityType: "CompetitionParticipant",
      entityId: participantId,
      before: { viewCount: participant.viewCount },
      after: { viewCount: result.viewCount, source: "AUTO" },
    });

    return {
      id: updated.id,
      creatorId: updated.creatorId,
      creatorName: updated.creator.displayName,
      status: updated.status,
      videoUrl: updated.videoUrl,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt,
      viewCount: updated.viewCount,
      viewCountUpdatedAt: updated.viewCountUpdatedAt,
      viewCountSource: updated.viewCountSource,
      joinedAt: updated.joinedAt,
    };
  }

  async updateViewCount(participantId: string, viewCount: number, actorUserId: string | null): Promise<CompetitionParticipantAdminResponse> {
    const participant = await this.findParticipantOrThrow(participantId);
    if (participant.status !== "APPROVED") {
      throw new DomainException("INVALID_STATE", "Faqat tasdiqlangan ishtirokchining ko'rishlar sonini yangilash mumkin.", { from: participant.status });
    }

    const updated = await this.prisma.competitionParticipant.update({
      where: { id: participantId },
      data: { viewCount, viewCountUpdatedAt: new Date(), viewCountSource: "MANUAL" },
      include: { creator: { select: { displayName: true } } },
    });

    await this.audit.record({
      actorId: actorUserId,
      action: "COMPETITION_VIEW_COUNT_UPDATED",
      entityType: "CompetitionParticipant",
      entityId: participantId,
      before: { viewCount: participant.viewCount },
      after: { viewCount },
    });

    return {
      id: updated.id,
      creatorId: updated.creatorId,
      creatorName: updated.creator.displayName,
      status: updated.status,
      videoUrl: updated.videoUrl,
      reviewNote: updated.reviewNote,
      reviewedAt: updated.reviewedAt,
      viewCount: updated.viewCount,
      viewCountUpdatedAt: updated.viewCountUpdatedAt,
      viewCountSource: updated.viewCountSource,
      joinedAt: updated.joinedAt,
    };
  }

  async getLeaderboard(competitionId: string, creatorId: string): Promise<CompetitionLeaderboardResponse> {
    const competition = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");

    const cacheKey = this.cache.buildKey("competition-leaderboard", { competitionId });
    let ranked = await this.cache.get<RankedCreator[]>(cacheKey);
    if (!ranked) {
      // Use the appropriate ranking function based on the competition's metric
      // Count orders/referrals from the creator's join date, not from competition start
      if (competition.metric === "ORDER_COUNT") {
        ranked = await this.rankCreatorsByOrderCountWithJoinDate(this.prisma, competitionId, competition.startAt, competition.endAt);
      } else if (competition.metric === "REFERRAL_COUNT") {
        ranked = await this.rankCreatorsByReferralCountWithJoinDate(this.prisma, competitionId, competition.startAt, competition.endAt);
      } else if (competition.metric === "INSTAGRAM_VIEWS") {
        ranked = await this.rankParticipantsByViewCount(competitionId);
      } else {
        // Default to commission ranking for backward compatibility
        ranked = await rankCreatorsByCommission(this.prisma, { from: competition.startAt, to: competition.endAt });
      }
      await this.cache.set(cacheKey, ranked, LEADERBOARD_CACHE_TTL_SECONDS);
    }

    const myIndex = ranked.findIndex((r) => r.creatorId === creatorId);
    return {
      competitionId,
      top: ranked.slice(0, LEADERBOARD_TOP_N).map((r, i) => ({ ...r, rank: i + 1 })),
      me: myIndex >= 0 ? { ...ranked[myIndex]!, rank: myIndex + 1 } : null,
    };
  }

  // Modified ranking functions that consider join date
  private async rankCreatorsByOrderCountWithJoinDate(
    prisma: PrismaService,
    competitionId: string,
    competitionStart: Date,
    competitionEnd: Date,
  ): Promise<RankedCreator[]> {
    // Get all participants with their join dates
    const participants = await prisma.competitionParticipant.findMany({
      where: { competitionId },
      include: { creator: true },
    });

    // For each participant, count orders from their join date
    const results = await Promise.all(
      participants.map(async (p: any) => {
        const from = p.joinedAt > competitionStart ? p.joinedAt : competitionStart;
        const ordersCount = await prisma.order.count({
          where: {
            commission: { creatorId: p.creatorId },
            status: "PAID",
            createdAt: { gte: from, lte: competitionEnd },
          },
        });

        const commissions = await prisma.commission.aggregate({
          where: {
            creatorId: p.creatorId,
            order: { status: "PAID", createdAt: { gte: from, lte: competitionEnd } },
          },
          _sum: { amountMinor: true },
        });

        return {
          creatorId: p.creatorId,
          displayName: p.creator.displayName,
          ordersCount,
          commissionMinor: commissions._sum.amountMinor || 0,
        };
      }),
    );

    // Sort by orders count descending
    return results.sort((a: any, b: any) => b.ordersCount - a.ordersCount);
  }

  private async rankCreatorsByReferralCountWithJoinDate(
    prisma: PrismaService,
    competitionId: string,
    competitionStart: Date,
    competitionEnd: Date,
  ): Promise<RankedCreator[]> {
    // Get all participants with their join dates
    const participants = await prisma.competitionParticipant.findMany({
      where: { competitionId },
      include: { creator: true },
    });

    // For each participant, count referrals from their join date
    const results = await Promise.all(
      participants.map(async (p: any) => {
        const from = p.joinedAt > competitionStart ? p.joinedAt : competitionStart;
        const referralCount = await prisma.creatorReferral.count({
          where: {
            referrer: { id: p.creatorId },
            createdAt: { gte: from, lte: competitionEnd },
          },
        });

        const commissions = await prisma.commission.aggregate({
          where: {
            creatorId: p.creatorId,
            order: { status: "PAID", createdAt: { gte: from, lte: competitionEnd } },
          },
          _sum: { amountMinor: true },
        });

        return {
          creatorId: p.creatorId,
          displayName: p.creator.displayName,
          ordersCount: referralCount, // Use referralCount as the metric
          commissionMinor: commissions._sum.amountMinor || 0,
        };
      }),
    );

    // Sort by referral count descending
    return results.sort((a: any, b: any) => b.ordersCount - a.ordersCount);
  }

  // INSTAGRAM_VIEWS ranking — only APPROVED participants count (a PENDING or REJECTED submission
  // has no business showing up on a public leaderboard). Reuses RankedCreator.ordersCount to carry
  // the view count, the same "generic field, per-metric meaning" convention the two methods above
  // already established for referralCount — the frontend already relabels this field per metric.
  private async rankParticipantsByViewCount(competitionId: string): Promise<RankedCreator[]> {
    const participants = await this.prisma.competitionParticipant.findMany({
      where: { competitionId, status: "APPROVED" },
      include: { creator: { select: { displayName: true } } },
      orderBy: { viewCount: "desc" },
    });
    return participants.map((p) => ({
      creatorId: p.creatorId,
      displayName: p.creator.displayName,
      commissionMinor: 0,
      ordersCount: p.viewCount,
    }));
  }
}
