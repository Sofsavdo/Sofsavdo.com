import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import { PAID_ORDER_STATUSES } from "./lib/analytics-filters.util";
import { creatorRevenueBreakdown, dailyOrderTrend, type DailyTrendRow } from "./lib/analytics-sql.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

export interface CampaignAnalyticsListItem {
  campaignId: string;
  name: string;
  status: string;
  ordersCount: number;
  revenueMinor: number;
  creatorCount: number;
}

export interface CampaignAnalyticsDetail {
  campaignId: string;
  name: string;
  status: string;
  range: { from: Date; to: Date };
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
  creatorCount: number;
  averageCreatorRevenueMinor: number;
  topCreators: Array<{ creatorId: string; displayName: string; ordersCount: number; revenueMinor: number }>;
  trend: DailyTrendRow[];
}

@Injectable()
export class CampaignAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async list(query: AnalyticsQueryDto): Promise<PaginatedResult<CampaignAnalyticsListItem>> {
    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("campaigns-list", { query, resolved });
    const cached = await this.cache.get<PaginatedResult<CampaignAnalyticsListItem>>(cacheKey);
    if (cached) return cached;

    const range = resolved.current;
    const [orderGroups, creatorGroups, campaigns] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["campaignId"],
        where: { campaignId: { not: null }, status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } },
        _sum: { totalMinor: true },
        _count: { _all: true },
      }),
      this.prisma.creatorCampaign.groupBy({ by: ["campaignId"], where: { status: "ACTIVE" } }),
      this.prisma.campaign.findMany({ select: { id: true, name: true, status: true } }),
    ]);

    const orderByCampaign = new Map(orderGroups.map((g) => [g.campaignId as string, g]));
    const creatorCountByCampaign = new Map<string, number>();
    for (const g of creatorGroups) creatorCountByCampaign.set(g.campaignId, (creatorCountByCampaign.get(g.campaignId) ?? 0) + 1);

    let items: CampaignAnalyticsListItem[] = campaigns.map((c) => {
      const orders = orderByCampaign.get(c.id);
      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        ordersCount: orders?._count._all ?? 0,
        revenueMinor: orders?._sum.totalMinor ?? 0,
        creatorCount: creatorCountByCampaign.get(c.id) ?? 0,
      };
    });

    items.sort((a, b) => b.revenueMinor - a.revenueMinor);
    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    items = items.slice(start, start + query.pageSize);

    const result = paginate(items, total, query);
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async detail(campaignId: string, query: AnalyticsQueryDto): Promise<CampaignAnalyticsDetail> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true, status: true } });
    if (!campaign) throw new DomainException("NOT_FOUND", "Campaign topilmadi.");

    const resolved = resolveAnalyticsRange(query);
    const range = resolved.current;

    const [orderAgg, clicksCount, creatorRows, activeCreatorGroups, trend] = await Promise.all([
      this.prisma.order.aggregate({
        where: { campaignId, status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } },
        _sum: { totalMinor: true },
        _count: { _all: true },
      }),
      this.prisma.referralVisit.count({ where: { campaignId, createdAt: { gte: range.from, lt: range.to } } }),
      creatorRevenueBreakdown(this.prisma, { from: range.from, to: range.to, paidStatuses: PAID_ORDER_STATUSES, campaignId }),
      this.prisma.creatorCampaign.groupBy({ by: ["creatorId"], where: { campaignId, status: "ACTIVE" } }),
      dailyOrderTrend(this.prisma, { from: range.from, to: range.to, paidStatuses: PAID_ORDER_STATUSES, campaignId }),
    ]);

    const topCreatorRows = creatorRows.slice(0, 5);
    const creators = await this.prisma.creatorProfile.findMany({ where: { id: { in: topCreatorRows.map((r) => r.creatorId) } }, select: { id: true, displayName: true } });
    const nameById = new Map(creators.map((c) => [c.id, c.displayName]));

    const ordersCount = orderAgg._count._all;
    const revenueMinor = orderAgg._sum.totalMinor ?? 0;
    const creatorCount = activeCreatorGroups.length;

    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      range,
      ordersCount,
      revenueMinor,
      clicksCount,
      conversionRate: clicksCount > 0 ? ordersCount / clicksCount : 0,
      creatorCount,
      averageCreatorRevenueMinor: creatorCount > 0 ? Math.round(revenueMinor / creatorCount) : 0,
      topCreators: topCreatorRows.map((r) => ({ creatorId: r.creatorId, displayName: nameById.get(r.creatorId) ?? r.creatorId, ordersCount: r.ordersCount, revenueMinor: r.revenueMinor })),
      trend,
    };
  }
}
