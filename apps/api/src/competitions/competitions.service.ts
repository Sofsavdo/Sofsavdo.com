import { Injectable } from "@nestjs/common";
import type { Competition, CompetitionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { DomainException } from "../common/errors/domain-error";
import { PaginationQueryDto, paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { rankCreatorsByCommission, type RankedCreator } from "../creator-leaderboard/rank-creators-by-commission.util";
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
  async listActiveForCreators(): Promise<CompetitionResponse[]> {
    const rows = await this.prisma.competition.findMany({ where: { status: "ACTIVE" }, orderBy: { startAt: "asc" } });
    return rows.map((r) => this.toResponse(r)).filter((r) => r.availability === "LIVE" || r.availability === "SCHEDULED");
  }

  async getLeaderboard(competitionId: string, creatorId: string): Promise<CompetitionLeaderboardResponse> {
    const competition = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new DomainException("NOT_FOUND", "Musobaqa topilmadi.");

    const cacheKey = this.cache.buildKey("competition-leaderboard", { competitionId });
    let ranked = await this.cache.get<RankedCreator[]>(cacheKey);
    if (!ranked) {
      ranked = await rankCreatorsByCommission(this.prisma, { from: competition.startAt, to: competition.endAt });
      await this.cache.set(cacheKey, ranked, LEADERBOARD_CACHE_TTL_SECONDS);
    }

    const myIndex = ranked.findIndex((r) => r.creatorId === creatorId);
    return {
      competitionId,
      top: ranked.slice(0, LEADERBOARD_TOP_N).map((r, i) => ({ ...r, rank: i + 1 })),
      me: myIndex >= 0 ? { ...ranked[myIndex]!, rank: myIndex + 1 } : null,
    };
  }
}
