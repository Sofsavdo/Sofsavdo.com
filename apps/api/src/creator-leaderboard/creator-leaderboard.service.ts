import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { resolveAnalyticsRange } from "../analytics/lib/time-range.resolver";
import { rankCreatorsByCommission } from "./rank-creators-by-commission.util";

// Longer than the dashboard's own 30s — one cache entry here serves EVERY creator's leaderboard
// request this month (unlike the dashboard, which is per-creator), so a wider TTL is a much bigger
// win for concurrent-traffic load: a busy moment with hundreds of creators checking their rank
// still only recomputes this once every 60s, not once per request. Matches the architecture
// review's own confirmed decision (short-interval polling, ~20-30s client refetch — the client
// polls faster than this TTL on purpose, so most polls are a guaranteed cache hit). See
// DECISIONS.md ADR-029.
const LEADERBOARD_CACHE_TTL_SECONDS = 60;

// Caps how many other creators' earnings are ever exposed in one response — a leaderboard is a
// deliberate, requested competitive/motivational feature (real display names + real amounts,
// unlike the admin analytics equivalent's audience), but "every creator's exact earnings,
// unbounded" is a bigger exposure surface than the feature needs. The requester's own entry is
// always included separately even when they fall outside this cap.
const LEADERBOARD_TOP_N = 20;

export interface LeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  commissionMinor: number;
  ordersCount: number;
}

export interface LeaderboardResponse {
  period: "this_month";
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null; // null when the requesting creator has no Commission this month yet
}

@Injectable()
export class CreatorLeaderboardService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getLeaderboard(creatorId: string): Promise<LeaderboardResponse> {
    const cacheKey = this.cache.buildKey("creator-leaderboard", { period: "this_month" });
    let ranked = await this.cache.get<Omit<LeaderboardEntry, "rank">[]>(cacheKey);
    if (!ranked) {
      ranked = await rankCreatorsByCommission(this.prisma, resolveAnalyticsRange({ range: "this_month" }).current);
      await this.cache.set(cacheKey, ranked, LEADERBOARD_CACHE_TTL_SECONDS);
    }

    const myIndex = ranked.findIndex((r) => r.creatorId === creatorId);
    return {
      period: "this_month",
      top: ranked.slice(0, LEADERBOARD_TOP_N).map((r, i) => ({ ...r, rank: i + 1 })),
      me: myIndex >= 0 ? { ...ranked[myIndex]!, rank: myIndex + 1 } : null,
    };
  }
}
