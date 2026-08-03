import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

// Same reasoning as ActivityTickerService's own TTL (creator-facing, 20s) — this is the public,
// homepage-facing counterpart, kept identical since it serves the same "does this feel alive"
// purpose for a different audience (a shopper, not a creator).
const CACHE_TTL_SECONDS = 20;
const FEED_LIMIT = 8;

export interface PublicActivityEvent {
  offerName: string;
  city: string | null;
  occurredAt: Date;
}

// Public, homepage-facing FOMO signal — deliberately much narrower than ActivityTickerService
// (creator-only): never exposes a creator's name, an amount, or any commission/payout data, only
// "someone in <city> just ordered <offer>". Real PAID/DELIVERED orders only, never fabricated —
// see docs/PROHIBITED.md's "fabricated stats" rule. Renders as an honest "nothing yet" empty state
// (same convention as FeaturedProducts) rather than inventing placeholder activity.
@Injectable()
export class PublicActivityService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getRecentActivity(): Promise<PublicActivityEvent[]> {
    const cacheKey = this.cache.buildKey("public-activity", {});
    const cached = await this.cache.get<PublicActivityEvent[]>(cacheKey);
    if (cached) return cached;

    const orders = await this.prisma.order.findMany({
      where: { status: { in: ["PAID", "DELIVERED"] } },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: { createdAt: true, offer: { select: { name: true } }, address: { select: { city: true } } },
    });

    const events: PublicActivityEvent[] = orders.map((o) => ({
      offerName: o.offer?.name ?? "Unknown",
      city: o.address?.city ?? null,
      occurredAt: o.createdAt,
    }));

    await this.cache.set(cacheKey, events, CACHE_TTL_SECONDS);
    return events;
  }
}
