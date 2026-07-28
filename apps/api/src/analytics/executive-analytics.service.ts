import { Injectable } from "@nestjs/common";
import type { Prisma, PaymentProviderType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange, type DateRange } from "./lib/time-range.resolver";
import { buildOrderDimensionFilters, PAID_ORDER_STATUSES, REVENUE_ORDER_STATUSES, PENDING_ORDER_STATUSES, DECIDED_REFUND_STATUSES } from "./lib/analytics-filters.util";
import { dailyOrderTrend, type DailyTrendRow } from "./lib/analytics-sql.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

// Business definitions below are the Phase 13 binding decisions (approved, see DECISIONS.md
// ADR-020) — not this service's own invention. Every number here traces back to one of those
// definitions; nothing is a guess made while coding.
export interface ExecutiveMetrics {
  gmvMinor: number;
  revenueMinor: number;
  netRevenueMinor: number;
  ordersCount: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  refundsMinor: number;
  refundRate: number;
  activeCreatorsCount: number;
  // Snapshot metrics (current platform state, not a period total) — present on `current` only.
  // There is no state-history table to reconstruct "as of a past date" from, so no historical
  // comparison is attempted for these two rather than fabricating one. See ANALYTICS.md §13/§3.
  activeCampaignsCount?: number;
  activeProductsCount?: number;
  // "Creator link konversiyasi" per the approved decision — deliberately not labeled a
  // platform-wide conversion rate; see ANALYTICS.md Finding #2.
  creatorLinkConversionRate: number;
  averageOrderValueMinor: number;
  newCustomers: number;
  returningCustomers: number;
}

export interface ExecutiveAnalyticsResponse {
  current: ExecutiveMetrics;
  previous?: ExecutiveMetrics;
  deltaPct?: Partial<Record<keyof ExecutiveMetrics, number | null>>;
  // Daily-bucketed, current-range only — a trend chart compares shape over time within one range,
  // not point-by-point against a second range the way the KPI tiles do.
  trend: DailyTrendRow[];
  // Surfaced from the same `order.groupBy(by:["status"])` call `computeForRange` already makes to
  // derive gmvMinor/paidOrdersCount/etc. — not a second query, just exposing data already fetched.
  // Current-range only, matching `trend` (a status mix is a shape-of-this-period question).
  statusBreakdown: Array<{ status: string; count: number }>;
}

function isOpenPeriod(range: DateRange, now: Date): boolean {
  return range.to.getTime() > now.getTime();
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10; // one decimal place
}

@Injectable()
export class ExecutiveAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getSummary(query: AnalyticsQueryDto): Promise<ExecutiveAnalyticsResponse> {
    const now = new Date();
    const resolved = resolveAnalyticsRange(query, now);
    const cacheKey = this.cache.buildKey("executive", { query, resolved });
    const cached = await this.cache.get<ExecutiveAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const { metrics: current, statusBreakdown } = await this.computeForRange(query, resolved.current, true);
    let previous: ExecutiveMetrics | undefined;
    let deltaPct: ExecutiveAnalyticsResponse["deltaPct"];
    if (resolved.previous) {
      previous = (await this.computeForRange(query, resolved.previous, false)).metrics;
      const keys: (keyof ExecutiveMetrics)[] = [
        "gmvMinor",
        "revenueMinor",
        "netRevenueMinor",
        "ordersCount",
        "paidOrdersCount",
        "pendingOrdersCount",
        "refundsMinor",
        "refundRate",
        "activeCreatorsCount",
        "creatorLinkConversionRate",
        "averageOrderValueMinor",
        "newCustomers",
        "returningCustomers",
      ];
      deltaPct = {};
      for (const key of keys) deltaPct[key] = pctDelta(current[key] as number, previous[key] as number);
    }

    const trend = await dailyOrderTrend(this.prisma, {
      from: resolved.current.from,
      to: resolved.current.to,
      paidStatuses: PAID_ORDER_STATUSES,
      campaignId: query.campaignId,
    });

    const response: ExecutiveAnalyticsResponse = { current, previous, deltaPct, trend, statusBreakdown };
    await this.cache.set(cacheKey, response, isOpenPeriod(resolved.current, now) ? 60 : 900);
    return response;
  }

  private async computeForRange(
    query: AnalyticsQueryDto,
    range: DateRange,
    includeSnapshots: boolean,
  ): Promise<{ metrics: ExecutiveMetrics; statusBreakdown: Array<{ status: string; count: number }> }> {
    const dims = buildOrderDimensionFilters(query);
    const orderWhere: Prisma.OrderWhereInput = { ...dims, createdAt: { gte: range.from, lt: range.to } };
    if (query.paymentMethod) orderWhere.payment = { provider: query.paymentMethod as PaymentProviderType };

    const attributionWhere: Prisma.AttributionWhereInput = { createdAt: { gte: range.from, lt: range.to } };
    if (query.campaignId) attributionWhere.campaignId = query.campaignId;
    if (query.creatorId) attributionWhere.creatorId = query.creatorId;

    const visitWhere: Prisma.ReferralVisitWhereInput = { createdAt: { gte: range.from, lt: range.to } };
    if (query.campaignId) visitWhere.campaignId = query.campaignId;
    if (query.creatorId) visitWhere.creatorId = query.creatorId;

    const [statusGroups, refundGroups, attributedPaidOrdersCount, activeCreatorGroups, referralVisitCount, snapshots, newReturning] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true }, _sum: { totalMinor: true } }),
      this.prisma.refund.groupBy({
        by: ["orderId"],
        where: { status: { in: [...DECIDED_REFUND_STATUSES] }, createdAt: { gte: range.from, lt: range.to }, order: dims },
        _sum: { amountMinor: true },
      }),
      this.prisma.order.count({ where: { ...orderWhere, status: { in: [...PAID_ORDER_STATUSES] }, attribution: { isNot: null } } }),
      this.prisma.attribution.groupBy({ by: ["creatorId"], where: attributionWhere }),
      this.prisma.referralVisit.count({ where: visitWhere }),
      includeSnapshots
        ? Promise.all([this.prisma.campaign.count({ where: { status: "ACTIVE" } }), this.prisma.product.count({ where: { status: "ACTIVE", offers: { some: { status: "ACTIVE" } } } })])
        : Promise.resolve(null),
      this.computeNewReturningCustomers(dims, range),
    ]);

    let gmvMinor = 0;
    let revenueMinor = 0;
    let ordersCount = 0;
    let paidOrdersCount = 0;
    let pendingOrdersCount = 0;
    const paidSet: readonly string[] = PAID_ORDER_STATUSES;
    const revenueSet: readonly string[] = REVENUE_ORDER_STATUSES;
    const pendingSet: readonly string[] = PENDING_ORDER_STATUSES;
    for (const g of statusGroups) {
      const count = g._count._all;
      const sum = g._sum.totalMinor ?? 0;
      ordersCount += count;
      if (paidSet.includes(g.status)) {
        gmvMinor += sum;
        paidOrdersCount += count;
      }
      if (revenueSet.includes(g.status)) revenueMinor += sum;
      if (pendingSet.includes(g.status)) pendingOrdersCount += count;
    }

    const refundedOrdersCount = refundGroups.length;
    const refundsMinor = refundGroups.reduce((acc, g) => acc + (g._sum.amountMinor ?? 0), 0);
    const netRevenueMinor = revenueMinor - refundsMinor;
    const refundRate = paidOrdersCount > 0 ? refundedOrdersCount / paidOrdersCount : 0;
    // AOV uses GMV (not net Revenue) as the numerator because "Paid Orders" (the denominator, per
    // the approved definition) still counts REFUNDED orders — pairing it with Revenue (which
    // excludes REFUNDED value) would understate AOV for a period with any refunds.
    const averageOrderValueMinor = paidOrdersCount > 0 ? Math.round(gmvMinor / paidOrdersCount) : 0;
    const creatorLinkConversionRate = referralVisitCount > 0 ? attributedPaidOrdersCount / referralVisitCount : 0;

    return {
      metrics: {
        gmvMinor,
        revenueMinor,
        netRevenueMinor,
        ordersCount,
        paidOrdersCount,
        pendingOrdersCount,
        refundsMinor,
        refundRate,
        activeCreatorsCount: activeCreatorGroups.length,
        ...(snapshots ? { activeCampaignsCount: snapshots[0], activeProductsCount: snapshots[1] } : {}),
        creatorLinkConversionRate,
        averageOrderValueMinor,
        newCustomers: newReturning.newCustomers,
        returningCustomers: newReturning.returningCustomers,
      },
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    };
  }

  // Two groupBy calls, never one query per customer (no N+1): first finds which customers ordered
  // in-period, then — scoped to only that (bounded) set of customerIds — finds each one's
  // all-time first-order date and total order count. Applying the same dimension filters to both
  // queries keeps "returning" meaning "returning within this filtered scope" consistently, e.g. if
  // filtered to one campaign, "returning" means bought via that campaign more than once, not
  // bought from the platform more than once.
  private async computeNewReturningCustomers(dims: Prisma.OrderWhereInput, range: DateRange): Promise<{ newCustomers: number; returningCustomers: number }> {
    const periodGroups = await this.prisma.order.groupBy({ by: ["customerId"], where: { ...dims, createdAt: { gte: range.from, lt: range.to } } });
    if (periodGroups.length === 0) return { newCustomers: 0, returningCustomers: 0 };
    const customerIds = periodGroups.map((g) => g.customerId);
    const allTimeGroups = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { ...dims, customerId: { in: customerIds } },
      _min: { createdAt: true },
      _count: { _all: true },
    });
    let newCustomers = 0;
    let returningCustomers = 0;
    for (const g of allTimeGroups) {
      const firstOrderAt = g._min.createdAt as Date;
      if (firstOrderAt.getTime() >= range.from.getTime() && firstOrderAt.getTime() < range.to.getTime()) newCustomers++;
      if (g._count._all >= 2) returningCustomers++;
    }
    return { newCustomers, returningCustomers };
  }
}
