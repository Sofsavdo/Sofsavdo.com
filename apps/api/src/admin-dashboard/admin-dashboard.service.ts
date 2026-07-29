import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExecutiveAnalyticsService } from "../analytics/executive-analytics.service";
import { CreatorAnalyticsService } from "../analytics/creator-analytics.service";
import { ProductAnalyticsService } from "../analytics/product-analytics.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { PAID_ORDER_STATUSES } from "../analytics/lib/analytics-filters.util";
import type { DailyTrendRow } from "../analytics/lib/analytics-sql.util";
import { AnalyticsQueryDto } from "../analytics/dto/analytics-query.dto";
import type { AnalyticsRangePreset } from "../analytics/lib/time-range.resolver";

// Every sub-service's query param is a real class instance (its `skip`/`take` are getters derived
// from page/pageSize, not plain fields — a bare object literal doesn't structurally satisfy that),
// same as what ValidationPipe would construct from an actual HTTP request. This is a programmatic
// caller, not an HTTP one, so it builds that instance itself.
function analyticsQuery(range: AnalyticsRangePreset, pageSize = 20): AnalyticsQueryDto {
  return Object.assign(new AnalyticsQueryDto(), { range, compare: "none", page: 1, pageSize, sortDir: "desc" as const });
}

// Short — this is the admin's front-door screen, visited constantly; a snapshot up to 60s stale is
// an acceptable trade for never recomputing GMV/top-N/commission-liability on every single page
// load. Best-effort/fail-open via AnalyticsCacheService, same convention as every other cache in
// this codebase.
const DASHBOARD_CACHE_TTL_SECONDS = 60;
const TOP_N = 5;
// Statuses that still represent money the platform owes someone — a genuinely "not yet settled"
// snapshot, not scoped to any period (this is a balance-sheet figure, not a period total).
const OUTSTANDING_COMMISSION_STATUSES = ["PENDING", "APPROVED", "PAYABLE"] as const;
const OUTSTANDING_PAYOUT_STATUSES = ["REQUESTED", "APPROVED", "PROCESSING"] as const;

export interface AdminDashboardTopEntry {
  name: string;
  revenueMinor: number;
}

export interface AdminDashboardTask {
  text: string;
  href: string;
}

// Deliberately only the 3 stages this schema can actually track today (ReferralVisit for clicks,
// Order for orders/paidOrders). "Landing view" and "checkout start" were fabricated in the old
// mock dashboard — no event table records either as a distinct moment, only a completed Order —
// so they're dropped rather than faked, same "one real number beats a fake one" precedent as
// Phase J's dashboard-stats rewrite (see DECISIONS.md ADR-031).
export interface AdminDashboardFunnel {
  clicks: number;
  orders: number;
  paidOrders: number;
}

export interface AdminDashboardResponse {
  todayRevenueMinor: number;
  monthlyRevenueMinor: number;
  netRevenueMinor: number;
  paidOrders: number;
  conversionRate: number;
  averageOrderValueMinor: number;
  refundRate: number;
  activeCampaignsCount: number;
  creatorRevenueMinor: number;
  directRevenueMinor: number;
  commissionLiabilityMinor: number;
  pendingPayoutsMinor: number;
  trend: DailyTrendRow[];
  funnel: AdminDashboardFunnel;
  tasks: AdminDashboardTask[];
  topOffers: AdminDashboardTopEntry[];
  topCreators: AdminDashboardTopEntry[];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private prisma: PrismaService,
    private executive: ExecutiveAnalyticsService,
    private creatorAnalytics: CreatorAnalyticsService,
    private productAnalytics: ProductAnalyticsService,
    private cache: AnalyticsCacheService,
  ) {}

  async getSummary(): Promise<AdminDashboardResponse> {
    const cacheKey = this.cache.buildKey("admin-dashboard", {});
    const cached = await this.cache.get<AdminDashboardResponse>(cacheKey);
    if (cached) return cached;

    const [today, month, revenueSplit, commissionLiability, pendingPayouts, tasks, topOffersPage, topCreatorsPage] = await Promise.all([
      this.executive.getSummary(analyticsQuery("today")),
      this.executive.getSummary(analyticsQuery("this_month")),
      this.creatorVsDirectRevenue(),
      this.prisma.commission.aggregate({ where: { status: { in: [...OUTSTANDING_COMMISSION_STATUSES] } }, _sum: { amountMinor: true } }),
      this.prisma.payout.aggregate({ where: { status: { in: [...OUTSTANDING_PAYOUT_STATUSES] } }, _sum: { amountMinor: true } }),
      this.buildTasks(),
      this.productAnalytics.list(analyticsQuery("this_month", TOP_N)),
      this.creatorAnalytics.list(analyticsQuery("this_month", TOP_N)),
    ]);

    const response: AdminDashboardResponse = {
      todayRevenueMinor: today.current.revenueMinor,
      monthlyRevenueMinor: month.current.revenueMinor,
      netRevenueMinor: month.current.netRevenueMinor,
      paidOrders: month.current.paidOrdersCount,
      conversionRate: month.current.creatorLinkConversionRate,
      averageOrderValueMinor: month.current.averageOrderValueMinor,
      refundRate: month.current.refundRate,
      activeCampaignsCount: month.current.activeCampaignsCount ?? 0,
      creatorRevenueMinor: revenueSplit.creatorRevenueMinor,
      directRevenueMinor: revenueSplit.directRevenueMinor,
      commissionLiabilityMinor: commissionLiability._sum.amountMinor ?? 0,
      pendingPayoutsMinor: pendingPayouts._sum.amountMinor ?? 0,
      trend: month.trend,
      funnel: { clicks: revenueSplit.clicksThisMonth, orders: month.current.ordersCount, paidOrders: month.current.paidOrdersCount },
      tasks,
      topOffers: topOffersPage.items.map((o) => ({ name: o.name, revenueMinor: o.revenueMinor })),
      topCreators: topCreatorsPage.items.map((c) => ({ name: c.displayName, revenueMinor: c.revenueMinor })),
    };
    await this.cache.set(cacheKey, response, DASHBOARD_CACHE_TTL_SECONDS);
    return response;
  }

  // "Creator orqali" vs "Direct" revenue — an Order with a real Attribution row was referred by a
  // creator; one without wasn't. Not exposed by ExecutiveAnalyticsService today, so computed here
  // directly rather than adding a rarely-needed split to that shared service's own response shape.
  private async creatorVsDirectRevenue(): Promise<{ creatorRevenueMinor: number; directRevenueMinor: number; clicksThisMonth: number }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalAgg, creatorAgg, clicksThisMonth] = await Promise.all([
      this.prisma.order.aggregate({ where: { status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: monthStart } }, _sum: { totalMinor: true } }),
      this.prisma.order.aggregate({
        where: { status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: monthStart }, attribution: { isNot: null } },
        _sum: { totalMinor: true },
      }),
      this.prisma.referralVisit.count({ where: { createdAt: { gte: monthStart } } }),
    ]);
    const total = totalAgg._sum.totalMinor ?? 0;
    const creator = creatorAgg._sum.totalMinor ?? 0;
    return { creatorRevenueMinor: creator, directRevenueMinor: total - creator, clicksThisMonth };
  }

  // Real, bounded counts of things an admin actually needs to act on — replaces the old mock
  // dashboard's randomly-flavored "tasks" list. Each count is a single cheap aggregate query, not
  // a re-derivation of any other domain's business logic.
  private async buildTasks(): Promise<AdminDashboardTask[]> {
    const [pendingPayoutsCount, pendingRefundsCount, pendingCreatorApplicationsCount] = await Promise.all([
      this.prisma.payout.count({ where: { status: "REQUESTED" } }),
      this.prisma.refund.count({ where: { status: "REQUESTED" } }),
      this.prisma.creatorApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    ]);
    const tasks: AdminDashboardTask[] = [];
    if (pendingPayoutsCount > 0) tasks.push({ text: `${pendingPayoutsCount} ta payout so'rovi ko'rib chiqilishi kerak`, href: "/admin/payouts" });
    if (pendingRefundsCount > 0) tasks.push({ text: `${pendingRefundsCount} ta refund so'rovi kutilmoqda`, href: "/admin/refunds" });
    if (pendingCreatorApplicationsCount > 0) {
      tasks.push({ text: `${pendingCreatorApplicationsCount} ta creator arizasi kutilmoqda`, href: "/admin/creator-applications" });
    }
    return tasks;
  }
}
