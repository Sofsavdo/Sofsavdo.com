import { Injectable } from "@nestjs/common";
import { Prisma, type BioComplianceStatus, type CreatorTier } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService, type WalletBalance } from "../commissions/commissions.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { resolveAnalyticsRange, type DateRange } from "../analytics/lib/time-range.resolver";
import { PAID_ORDER_STATUSES } from "../analytics/lib/analytics-filters.util";

// Short — a creator's own numbers change with every new order/commission event, but this absorbs
// a dashboard's own repeat polling (and a page reload immediately after another) without hitting
// Postgres every single time. Best-effort/fail-open via AnalyticsCacheService: a Redis outage just
// means every request recomputes live, never a 500 — see DECISIONS.md ADR-029.
const DASHBOARD_CACHE_TTL_SECONDS = 30;

// Reversed commissions never represent real earnings or real sales value — excluded from every
// money aggregate below. `ordersCount` deliberately does NOT exclude them (a sale did happen, even
// if its commission was later rejected/refunded), matching how a creator would actually read
// "how many orders came from me today."
const EXCLUDED_FROM_EARNINGS = ["REJECTED", "REFUNDED"] as const;

export interface CreatorDashboardPeriodStats {
  ordersCount: number;
  salesMinor: number;
  commissionMinor: number;
}

export interface CreatorDashboardDailyPoint {
  date: string; // YYYY-MM-DD
  revenueMinor: number;
}

// Phase O — the creator-facing counterpart of AdminDashboardResponse.funnel, same 3 real stages
// (no "landing view"/"checkout start" — this schema can't track either, see AdminDashboardService's
// own comment) and the same definition of "order"/"paid order" (via Attribution/Order, not
// Commission — a Commission's own status lifecycle is about settlement, not whether the order
// itself was ever paid). Scoped to this creator's own ReferralVisit/Attribution rows instead of
// platform-wide.
export interface CreatorDashboardFunnel {
  period: "this_month";
  clicks: number;
  orders: number;
  paidOrders: number;
  conversionRate: number;
}

export interface CreatorDashboardStats {
  today: CreatorDashboardPeriodStats & { clicks: number; conversionRate: number };
  monthToDate: CreatorDashboardPeriodStats;
  lifetime: CreatorDashboardPeriodStats;
  wallet: WalletBalance;
  // Replaces the old mocked series7d/series30d/series90d (apps/web/src/mocks/store.ts) — those were
  // Math.random()-generated for every creator except one hardcoded demo account, never real data.
  // One real 30-day series is enough for the dashboard's chart; three fake ones were never
  // providing real information at three different resolutions, just three flavors of fabrication.
  dailyRevenue30d: CreatorDashboardDailyPoint[];
  funnel: CreatorDashboardFunnel;
  // Phase Q — surfaced so the creator-facing dashboard can show why a payout might be blocked
  // (see PayoutsService.requestPayout) before they even try, rather than only finding out from an
  // error after clicking "So'rov yuborish".
  compliance: { bioComplianceStatus: BioComplianceStatus; tier: CreatorTier };
}

@Injectable()
export class CreatorDashboardService {
  constructor(
    private prisma: PrismaService,
    private commissions: CommissionsService,
    private cache: AnalyticsCacheService,
  ) {}

  async getStats(creatorId: string): Promise<CreatorDashboardStats> {
    const cacheKey = this.cache.buildKey("creator-dashboard", { creatorId });
    const cached = await this.cache.get<CreatorDashboardStats>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayRange = resolveAnalyticsRange({ range: "today" }, now).current;
    const monthRange = resolveAnalyticsRange({ range: "this_month" }, now).current;
    // UTC throughout (not local-calendar-day, unlike today/monthRange above) — this window only
    // feeds fillDays' own UTC-keyed bucketing below, so the two must agree on which timezone
    // "midnight" means or the chart could double-count or drop a day at its boundary.
    const trendFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));

    const [today, monthToDate, lifetime, clicksToday, wallet, trendRows, funnel, profile] = await Promise.all([
      this.periodStats(creatorId, todayRange),
      this.periodStats(creatorId, monthRange),
      this.periodStats(creatorId),
      this.prisma.referralVisit.count({ where: { creatorId, createdAt: { gte: todayRange.from, lt: todayRange.to } } }),
      this.commissions.getWalletBalance(creatorId),
      this.dailyTrend(creatorId, trendFrom),
      this.monthlyFunnel(creatorId, monthRange),
      this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { bioComplianceStatus: true, tier: true } }),
    ]);

    const result: CreatorDashboardStats = {
      today: { ...today, clicks: clicksToday, conversionRate: clicksToday > 0 ? today.ordersCount / clicksToday : 0 },
      monthToDate,
      lifetime,
      wallet,
      compliance: { bioComplianceStatus: profile.bioComplianceStatus, tier: profile.tier },
      dailyRevenue30d: this.fillDays(trendFrom, now, trendRows),
      funnel,
    };
    await this.cache.set(cacheKey, result, DASHBOARD_CACHE_TTL_SECONDS);
    return result;
  }

  // Click (ReferralVisit) → Order → Paid order, all scoped to this creator's own
  // ReferralVisit.creatorId / Attribution.creatorId rows — the exact same 3-stage definition
  // AdminDashboardService's platform-wide funnel uses, just filtered to one creator. "Orders" and
  // "paid orders" are counted via Attribution (not Commission) because a Commission's status
  // lifecycle tracks settlement, not whether the underlying Order was ever actually paid for.
  private async monthlyFunnel(creatorId: string, range: DateRange): Promise<CreatorDashboardFunnel> {
    const [clicks, orders, paidOrders] = await Promise.all([
      this.prisma.referralVisit.count({ where: { creatorId, createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.attribution.count({ where: { creatorId, createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.attribution.count({
        where: { creatorId, createdAt: { gte: range.from, lt: range.to }, order: { status: { in: [...PAID_ORDER_STATUSES] } } },
      }),
    ]);
    return { period: "this_month", clicks, orders, paidOrders, conversionRate: clicks > 0 ? paidOrders / clicks : 0 };
  }

  private async periodStats(creatorId: string, range?: DateRange): Promise<CreatorDashboardPeriodStats> {
    const baseWhere: Prisma.CommissionWhereInput = { creatorId, ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}) };
    const [ordersCount, sums] = await Promise.all([
      this.prisma.commission.count({ where: baseWhere }),
      this.prisma.commission.aggregate({
        where: { ...baseWhere, status: { notIn: [...EXCLUDED_FROM_EARNINGS] } },
        _sum: { baseAmountMinor: true, amountMinor: true },
      }),
    ]);
    return { ordersCount, salesMinor: sums._sum.baseAmountMinor ?? 0, commissionMinor: sums._sum.amountMinor ?? 0 };
  }

  // Raw SQL for the same reason analytics-sql.util.ts's dailyOrderTrend is raw — `date_trunc`
  // grouping isn't expressible through Prisma's ORM-level `groupBy`. Same Prisma.sql
  // parameterization convention, scoped to a single creator instead of platform-wide.
  private async dailyTrend(creatorId: string, from: Date): Promise<{ day: Date; revenueMinor: number }[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; revenueMinor: bigint | null }[]>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt") as day,
               COALESCE(SUM("amountMinor"), 0)::bigint as "revenueMinor"
        FROM "Commission"
        WHERE "creatorId" = ${creatorId} AND "createdAt" >= ${from} AND status::text NOT IN ('REJECTED', 'REFUNDED')
        GROUP BY day
        ORDER BY day
      `,
    );
    return rows.map((r) => ({ day: r.day, revenueMinor: Number(r.revenueMinor ?? 0) }));
  }

  // date_trunc only returns rows for days that had at least one Commission — this fills every day
  // in [from, to] with 0 so the frontend chart gets a continuous 30-point x-axis, not gaps. Keyed
  // entirely in UTC (matching `trendFrom` above and Postgres' `date_trunc` on a UTC-stored
  // timestamptz) — mixing UTC keys with local-calendar-day arithmetic here would risk an off-by-one
  // day depending on the server's timezone offset from UTC.
  private fillDays(from: Date, to: Date, rows: { day: Date; revenueMinor: number }[]): CreatorDashboardDailyPoint[] {
    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r.revenueMinor]));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    const points: CreatorDashboardDailyPoint[] = [];
    for (const cursor = new Date(from); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      points.push({ date: key, revenueMinor: byDay.get(key) ?? 0 });
    }
    return points;
  }
}
