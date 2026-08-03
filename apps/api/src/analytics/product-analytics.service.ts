import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import { PAID_ORDER_STATUSES, DECIDED_REFUND_STATUSES } from "./lib/analytics-filters.util";
import { refundBreakdownByOffer, dailyOrderTrend, type DailyTrendRow } from "./lib/analytics-sql.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

export interface ProductAnalyticsListItem {
  productId: string;
  name: string;
  ordersCount: number;
  revenueMinor: number;
  refundsMinor: number;
  averageOrderValueMinor: number;
}

export interface ProductAnalyticsDetail {
  productId: string;
  name: string;
  range: { from: Date; to: Date };
  ordersCount: number;
  revenueMinor: number;
  refundsMinor: number;
  refundedOrdersCount: number;
  clicksCount: number;
  conversionRate: number;
  averageOrderValueMinor: number;
  trend: DailyTrendRow[];
}

@Injectable()
export class ProductAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  // Shared by list() and best-sellers/slow-movers — same data, sorted both directions
  // (ANALYTICS.md §11.7: "one query, two sort orders, not two separate features").
  private async computeAllProductMetrics(range: { from: Date; to: Date }): Promise<ProductAnalyticsListItem[]> {
    const [orderGroups, refundRows, offers, products] = await Promise.all([
      this.prisma.order.groupBy({ by: ["offerId"], where: { status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } }, _sum: { totalMinor: true }, _count: { _all: true } }),
      refundBreakdownByOffer(this.prisma, { from: range.from, to: range.to, decidedStatuses: DECIDED_REFUND_STATUSES }),
      this.prisma.offer.findMany({ select: { id: true, productId: true } }),
      this.prisma.product.findMany({ select: { id: true, name: true } }),
    ]);

    const productIdByOffer = new Map(offers.map((o) => [o.id, o.productId]));
    const nameByProduct = new Map(products.map((p) => [p.id, p.name]));

    const byProduct = new Map<string, { ordersCount: number; revenueMinor: number; refundsMinor: number }>();
    for (const g of orderGroups) {
      if (!g.offerId) continue;
      const productId = productIdByOffer.get(g.offerId);
      if (!productId) continue;
      const cur = byProduct.get(productId) ?? { ordersCount: 0, revenueMinor: 0, refundsMinor: 0 };
      cur.ordersCount += g._count._all;
      cur.revenueMinor += g._sum.totalMinor ?? 0;
      byProduct.set(productId, cur);
    }
    for (const r of refundRows) {
      if (!r.offerId) continue;
      const productId = productIdByOffer.get(r.offerId);
      if (!productId) continue;
      const cur = byProduct.get(productId) ?? { ordersCount: 0, revenueMinor: 0, refundsMinor: 0 };
      cur.refundsMinor += r.refundsMinor;
      byProduct.set(productId, cur);
    }

    return [...byProduct.entries()].map(([productId, m]) => ({
      productId,
      name: nameByProduct.get(productId) ?? productId,
      ordersCount: m.ordersCount,
      revenueMinor: m.revenueMinor,
      refundsMinor: m.refundsMinor,
      averageOrderValueMinor: m.ordersCount > 0 ? Math.round(m.revenueMinor / m.ordersCount) : 0,
    }));
  }

  async list(query: AnalyticsQueryDto): Promise<PaginatedResult<ProductAnalyticsListItem>> {
    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("products-list", { query, resolved });
    const cached = await this.cache.get<PaginatedResult<ProductAnalyticsListItem>>(cacheKey);
    if (cached) return cached;

    let items = await this.computeAllProductMetrics(resolved.current);
    // sortDir=asc surfaces slow movers, desc (the default) surfaces best sellers — same list,
    // same query, the caller picks the direction.
    items.sort((a, b) => (query.sortDir === "asc" ? a.revenueMinor - b.revenueMinor : b.revenueMinor - a.revenueMinor));

    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    items = items.slice(start, start + query.pageSize);

    const result = paginate(items, total, query);
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async detail(productId: string, query: AnalyticsQueryDto): Promise<ProductAnalyticsDetail> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
    if (!product) throw new DomainException("NOT_FOUND", "Mahsulot topilmadi.");

    const resolved = resolveAnalyticsRange(query);
    const range = resolved.current;
    const offers = await this.prisma.offer.findMany({ where: { productId }, select: { id: true } });
    const offerIds = offers.map((o) => o.id);

    const [orderAgg, refundRows, clicksCount, trend] = await Promise.all([
      offerIds.length > 0
        ? this.prisma.order.aggregate({ where: { offerId: { in: offerIds }, status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to } }, _sum: { totalMinor: true }, _count: { _all: true } })
        : Promise.resolve({ _sum: { totalMinor: 0 }, _count: { _all: 0 } }),
      refundBreakdownByOffer(this.prisma, { from: range.from, to: range.to, decidedStatuses: DECIDED_REFUND_STATUSES, offerIds }),
      this.prisma.referralVisit.count({ where: { offerId: { in: offerIds }, createdAt: { gte: range.from, lt: range.to } } }),
      dailyOrderTrend(this.prisma, { from: range.from, to: range.to, paidStatuses: PAID_ORDER_STATUSES, offerIds }),
    ]);

    const ordersCount = orderAgg._count._all;
    const revenueMinor = orderAgg._sum.totalMinor ?? 0;
    const refundsMinor = refundRows.reduce((acc, r) => acc + r.refundsMinor, 0);
    const refundedOrdersCount = refundRows.reduce((acc, r) => acc + r.refundedOrdersCount, 0);

    return {
      productId: product.id,
      name: product.name,
      range,
      ordersCount,
      revenueMinor,
      refundsMinor,
      refundedOrdersCount,
      clicksCount,
      conversionRate: clicksCount > 0 ? ordersCount / clicksCount : 0,
      averageOrderValueMinor: ordersCount > 0 ? Math.round(revenueMinor / ordersCount) : 0,
      trend,
    };
  }
}
