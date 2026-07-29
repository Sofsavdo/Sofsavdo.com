import { Injectable } from "@nestjs/common";
import type { CreatorFundContribution } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import { AuditService } from "../common/audit/audit.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { DomainException } from "../common/errors/domain-error";
import type { ContributeToFundDto } from "./dto/contribute-to-fund.dto";

// Platform-wide total changes on every contribution, same "one cache entry for everyone" shape as
// the leaderboard/ticker — short enough that a fresh contribution shows up in the platform total
// within one TTL window, long enough to absorb concurrent traffic.
const FUND_STATS_CACHE_TTL_SECONDS = 30;
const LEADERBOARD_CACHE_TTL_SECONDS = 60;
const LEADERBOARD_TOP_N = 20;

export interface CreatorFundContributionResponse {
  id: string;
  amountMinor: number;
  currency: string;
  message: string | null;
  createdAt: Date;
}

export interface CreatorFundStatsResponse {
  totalMinor: number;
  currency: string;
  myTotalMinor: number;
}

export interface CreatorFundLeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  totalMinor: number;
}

export interface CreatorFundLeaderboardResponse {
  top: CreatorFundLeaderboardEntry[];
  me: CreatorFundLeaderboardEntry | null;
}

@Injectable()
export class CreatorFundService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
    private audit: AuditService,
    private cache: AnalyticsCacheService,
  ) {}

  private toResponse(c: CreatorFundContribution): CreatorFundContributionResponse {
    return { id: c.id, amountMinor: c.amountMinor, currency: c.currency, message: c.message, createdAt: c.createdAt };
  }

  // A contribution is an internal transfer with no external processing step to wait for (unlike a
  // Payout — see CommissionsService.contributeToFund's own comment) — it locks and settles the
  // creator's PAYABLE commissions in the same transaction as creating the ledger row, so the
  // creator sees it confirmed immediately, not "pending".
  async contribute(creatorId: string, userId: string, dto: ContributeToFundDto): Promise<CreatorFundContributionResponse> {
    if (dto.amountMinor <= 0) {
      throw new DomainException("INVALID_AMOUNT", "Hissa miqdori musbat bo'lishi kerak.");
    }
    const contribution = await this.prisma.$transaction(async (tx) => {
      const created = await tx.creatorFundContribution.create({ data: { creatorId, amountMinor: dto.amountMinor, message: dto.message } });
      await this.commissions.contributeToFund(tx, creatorId, dto.amountMinor, created.id);
      return created;
    });
    await this.audit.record({ actorId: userId, action: "FUND_CONTRIBUTION_CREATED", entityType: "CreatorFundContribution", entityId: contribution.id, after: { amountMinor: dto.amountMinor } });
    return this.toResponse(contribution);
  }

  async getStats(creatorId: string): Promise<CreatorFundStatsResponse> {
    const cacheKey = this.cache.buildKey("creator-fund-total", {});
    let totalMinor = await this.cache.get<number>(cacheKey);
    if (totalMinor === null) {
      const agg = await this.prisma.creatorFundContribution.aggregate({ _sum: { amountMinor: true } });
      totalMinor = agg._sum.amountMinor ?? 0;
      await this.cache.set(cacheKey, totalMinor, FUND_STATS_CACHE_TTL_SECONDS);
    }

    // The creator's own lifetime total is cheap (one indexed aggregate, scoped by creatorId) and
    // always reflects their own just-made contribution immediately — same reasoning the dashboard
    // and wallet balance already apply to "my own numbers should never look stale to me".
    const mine = await this.prisma.creatorFundContribution.aggregate({ where: { creatorId }, _sum: { amountMinor: true } });

    return { totalMinor, currency: "UZS", myTotalMinor: mine._sum.amountMinor ?? 0 };
  }

  async getLeaderboard(creatorId: string): Promise<CreatorFundLeaderboardResponse> {
    const cacheKey = this.cache.buildKey("creator-fund-leaderboard", {});
    let ranked = await this.cache.get<Omit<CreatorFundLeaderboardEntry, "rank">[]>(cacheKey);
    if (!ranked) {
      ranked = await this.rankContributors();
      await this.cache.set(cacheKey, ranked, LEADERBOARD_CACHE_TTL_SECONDS);
    }

    const myIndex = ranked.findIndex((r) => r.creatorId === creatorId);
    return {
      top: ranked.slice(0, LEADERBOARD_TOP_N).map((r, i) => ({ ...r, rank: i + 1 })),
      me: myIndex >= 0 ? { ...ranked[myIndex]!, rank: myIndex + 1 } : null,
    };
  }

  // Only one real caller (getLeaderboard above) — kept private/inline rather than extracted into
  // a shared util the way rankCreatorsByCommission was, since that extraction was justified by two
  // real callers (platform leaderboard + Competition leaderboard); this has one.
  private async rankContributors(): Promise<Omit<CreatorFundLeaderboardEntry, "rank">[]> {
    const rows = await this.prisma.creatorFundContribution.groupBy({ by: ["creatorId"], _sum: { amountMinor: true } });
    if (rows.length === 0) return [];

    const profiles = await this.prisma.creatorProfile.findMany({ where: { id: { in: rows.map((r) => r.creatorId) } }, select: { id: true, displayName: true } });
    const nameById = new Map(profiles.map((p) => [p.id, p.displayName]));

    return rows
      .map((r) => ({ creatorId: r.creatorId, displayName: nameById.get(r.creatorId) ?? "Creator", totalMinor: r._sum.amountMinor ?? 0 }))
      .sort((a, b) => b.totalMinor - a.totalMinor);
  }
}
