import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import { PAID_ORDER_STATUSES } from "./lib/analytics-filters.util";
import { creatorRevenueBreakdown } from "./lib/analytics-sql.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

export interface CreatorAnalyticsListItem {
  creatorId: string;
  displayName: string;
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
}

export interface CreatorAnalyticsDetail {
  creatorId: string;
  displayName: string;
  range: { from: Date; to: Date };
  earningsByStatus: Record<string, number>;
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
  viewsCount: null; // not measurable today — see ANALYTICS.md Finding #2. Explicit null, not omitted.
  topCampaigns: Array<{ campaignId: string; name: string; ordersCount: number; revenueMinor: number }>;
  topProducts: Array<{ productId: string; name: string; ordersCount: number; revenueMinor: number }>;
  approvalRate: number;
  averagePayoutMinor: number;
  referralStats: { totalReferred: number; qualified: number; totalRewardsMinor: number };
}

@Injectable()
export class CreatorAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async list(query: AnalyticsQueryDto): Promise<PaginatedResult<CreatorAnalyticsListItem>> {
    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("creators-list", { query, resolved });
    const cached = await this.cache.get<PaginatedResult<CreatorAnalyticsListItem>>(cacheKey);
    if (cached) return cached;

    const range = resolved.current;
    const [revenueRows, clickCounts, creators] = await Promise.all([
      creatorRevenueBreakdown(this.prisma, { from: range.from, to: range.to, paidStatuses: PAID_ORDER_STATUSES, campaignId: query.campaignId }),
      this.prisma.referralVisit.groupBy({
        by: ["creatorId"],
        where: { createdAt: { gte: range.from, lt: range.to }, ...(query.campaignId ? { campaignId: query.campaignId } : {}) },
        _count: { _all: true },
      }),
      this.prisma.creatorProfile.findMany({ select: { id: true, displayName: true } }),
    ]);

    const revenueById = new Map(revenueRows.map((r) => [r.creatorId, r]));
    const clickCountById = new Map(clickCounts.filter((c) => c.creatorId).map((c) => [c.creatorId as string, c._count._all]));

    const nameById = new Map(creators.map((c) => [c.id, c.displayName]));
    const activeCreatorIds = new Set<string>([...revenueById.keys(), ...clickCountById.keys()]);

    let items: CreatorAnalyticsListItem[] = [...activeCreatorIds].map((creatorId) => {
      const revenue = revenueById.get(creatorId);
      const clicks = clickCountById.get(creatorId) ?? 0;
      const ordersCount = revenue?.ordersCount ?? 0;
      return {
        creatorId,
        displayName: nameById.get(creatorId) ?? creatorId,
        ordersCount,
        revenueMinor: revenue?.revenueMinor ?? 0,
        clicksCount: clicks,
        conversionRate: clicks > 0 ? ordersCount / clicks : 0,
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

  async detail(creatorId: string, query: AnalyticsQueryDto): Promise<CreatorAnalyticsDetail> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { id: creatorId }, select: { id: true, displayName: true } });
    if (!creator) throw new DomainException("NOT_FOUND", "Creator topilmadi.");

    const resolved = resolveAnalyticsRange(query);
    const range = resolved.current;

    const [earningsGroups, revenueRows, clicksCount, campaignRows, offerRows, approvalGroups, payoutAvg, referral, rewardsAgg] = await Promise.all([
      this.prisma.commission.groupBy({ by: ["status"], where: { creatorId, createdAt: { gte: range.from, lt: range.to } }, _sum: { amountMinor: true } }),
      creatorRevenueBreakdown(this.prisma, { from: range.from, to: range.to, paidStatuses: PAID_ORDER_STATUSES, creatorId }),
      this.prisma.referralVisit.count({ where: { creatorId, createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.order.groupBy({
        by: ["campaignId"],
        where: { attribution: { creatorId }, campaignId: { not: null }, status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } },
        _sum: { totalMinor: true },
        _count: { _all: true },
        orderBy: { _sum: { totalMinor: "desc" } },
        take: 5,
      }),
      this.prisma.order.groupBy({
        by: ["offerId"],
        where: { attribution: { creatorId }, status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } },
        _sum: { totalMinor: true },
        _count: { _all: true },
        orderBy: { _sum: { totalMinor: "desc" } },
        take: 5,
      }),
      this.prisma.campaignApplication.groupBy({ by: ["status"], where: { creatorId, createdAt: { gte: range.from, lt: range.to } }, _count: { _all: true } }),
      this.prisma.payout.aggregate({ where: { creatorId, status: "PAID", requestedAt: { gte: range.from, lt: range.to } }, _avg: { amountMinor: true } }),
      this.prisma.creatorReferral.findMany({ where: { referrerCreatorId: creatorId }, select: { id: true, qualifiedAt: true } }),
      this.prisma.creatorReferralReward.aggregate({
        where: { referral: { referrerCreatorId: creatorId }, status: { in: ["APPROVED", "PAID"] } },
        _sum: { calculatedRewardMinor: true },
      }),
    ]);

    const earningsByStatus: Record<string, number> = {};
    for (const g of earningsGroups) earningsByStatus[g.status] = g._sum.amountMinor ?? 0;

    const revenue = revenueRows[0];
    const ordersCount = revenue?.ordersCount ?? 0;
    const revenueMinor = revenue?.revenueMinor ?? 0;

    const [campaigns, offers] = await Promise.all([
      this.prisma.campaign.findMany({ where: { id: { in: campaignRows.map((r) => r.campaignId as string) } }, select: { id: true, name: true } }),
      this.prisma.offer.findMany({ where: { id: { in: offerRows.map((r) => r.offerId) } }, select: { id: true, name: true, productId: true } }),
    ]);
    const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
    const offerNameById = new Map(offers.map((o) => [o.id, o.name]));
    const offerProductById = new Map(offers.map((o) => [o.id, o.productId]));

    const approvedCount = approvalGroups.find((g) => g.status === "APPROVED")?._count._all ?? 0;
    const rejectedCount = approvalGroups.find((g) => g.status === "REJECTED")?._count._all ?? 0;
    const decided = approvedCount + rejectedCount;

    return {
      creatorId: creator.id,
      displayName: creator.displayName,
      range,
      earningsByStatus,
      ordersCount,
      revenueMinor,
      clicksCount,
      conversionRate: clicksCount > 0 ? ordersCount / clicksCount : 0,
      viewsCount: null,
      topCampaigns: campaignRows.map((r) => ({
        campaignId: r.campaignId as string,
        name: campaignNameById.get(r.campaignId as string) ?? r.campaignId!,
        ordersCount: r._count._all,
        revenueMinor: r._sum.totalMinor ?? 0,
      })),
      topProducts: offerRows.map((r) => ({
        productId: offerProductById.get(r.offerId) ?? r.offerId,
        name: offerNameById.get(r.offerId) ?? r.offerId,
        ordersCount: r._count._all,
        revenueMinor: r._sum.totalMinor ?? 0,
      })),
      approvalRate: decided > 0 ? approvedCount / decided : 0,
      averagePayoutMinor: Math.round(payoutAvg._avg.amountMinor ?? 0),
      referralStats: {
        totalReferred: referral.length,
        qualified: referral.filter((r) => r.qualifiedAt !== null).length,
        totalRewardsMinor: rewardsAgg._sum.calculatedRewardMinor ?? 0,
      },
    };
  }
}
