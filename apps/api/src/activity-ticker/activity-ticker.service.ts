import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

// Shorter than the leaderboard's 60s (DECISIONS.md ADR-029) — a "live activity" feed reads as
// stale much sooner than a monthly ranking does, so this trades a bit more recompute load for a
// feed that visibly moves. Still platform-wide (one cache entry for everyone, same as the
// leaderboard), so concurrent creators watching the ticker never multiply the query load.
const TICKER_CACHE_TTL_SECONDS = 20;

// How far back each stream looks and how many raw rows each contributes before merging — generous
// enough that the feed rarely runs dry on a quiet day, capped so no single stream can dominate the
// query cost.
const LOOKBACK_HOURS = 72;
const PER_STREAM_LIMIT = 30;
const FEED_LIMIT = 30;

export type ActivityEventType = "SALE" | "PAYOUT" | "FUND_CONTRIBUTION";

export interface ActivityEvent {
  type: ActivityEventType;
  creatorDisplayName: string;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
}

export interface ActivityTickerResponse {
  events: ActivityEvent[];
}

@Injectable()
export class ActivityTickerService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getFeed(): Promise<ActivityTickerResponse> {
    const cacheKey = this.cache.buildKey("activity-ticker", {});
    const cached = await this.cache.get<ActivityEvent[]>(cacheKey);
    if (cached) return { events: cached };

    const events = await this.buildFeed();
    await this.cache.set(cacheKey, events, TICKER_CACHE_TTL_SECONDS);
    return { events };
  }

  // Merges three independently-real streams — a new sale (Commission created via a referral
  // attribution), a completed withdrawal (Payout reaching PAID), and a Creator Fund contribution —
  // rather than inventing a single unified "activity" event table this feature doesn't otherwise
  // need. Each stream is already exactly the row that stream's own domain writes for its own
  // reasons; this service only reads and interleaves them.
  private async buildFeed(): Promise<ActivityEvent[]> {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

    const [sales, payouts, contributions] = await Promise.all([
      this.prisma.commission.findMany({
        where: { createdAt: { gte: since }, status: { notIn: ["REJECTED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        take: PER_STREAM_LIMIT,
        select: { amountMinor: true, currency: true, createdAt: true, creator: { select: { displayName: true } } },
      }),
      this.prisma.payout.findMany({
        where: { status: "PAID", paidAt: { gte: since } },
        orderBy: { paidAt: "desc" },
        take: PER_STREAM_LIMIT,
        select: { amountMinor: true, currency: true, paidAt: true, creator: { select: { displayName: true } } },
      }),
      this.prisma.creatorFundContribution.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: PER_STREAM_LIMIT,
        select: { amountMinor: true, currency: true, createdAt: true, creator: { select: { displayName: true } } },
      }),
    ]);

    const events: ActivityEvent[] = [
      ...sales.map((c) => ({ type: "SALE" as const, creatorDisplayName: c.creator.displayName, amountMinor: c.amountMinor, currency: c.currency, occurredAt: c.createdAt })),
      ...payouts.map((p) => ({ type: "PAYOUT" as const, creatorDisplayName: p.creator.displayName, amountMinor: p.amountMinor, currency: p.currency, occurredAt: p.paidAt! })),
      ...contributions.map((f) => ({ type: "FUND_CONTRIBUTION" as const, creatorDisplayName: f.creator.displayName, amountMinor: f.amountMinor, currency: f.currency, occurredAt: f.createdAt })),
    ];

    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return events.slice(0, FEED_LIMIT);
  }
}
