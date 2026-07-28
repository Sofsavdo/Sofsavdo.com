import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

export interface CustomerAnalyticsResponse {
  range: { from: Date; to: Date };
  activeCustomersCount: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  averageLifetimeValueMinor: number;
  // Orders-per-customer (all-time, for customers active this period) — a simpler v1 proxy for
  // "order frequency" than a true tenure-normalized rate; see ANALYTICS.md §11.8.
  averageOrderFrequency: number;
}

@Injectable()
export class CustomerAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getSummary(query: AnalyticsQueryDto): Promise<CustomerAnalyticsResponse> {
    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("customers", { query, resolved });
    const cached = await this.cache.get<CustomerAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const range = resolved.current;
    const dims: Prisma.OrderWhereInput = {};
    if (query.campaignId) dims.campaignId = query.campaignId;
    if (query.productId) dims.offer = { productId: query.productId };
    if (query.region) dims.address = { region: { contains: query.region, mode: "insensitive" } };
    if (query.creatorId) dims.attribution = { creatorId: query.creatorId };

    const periodGroups = await this.prisma.order.groupBy({ by: ["customerId"], where: { ...dims, createdAt: { gte: range.from, lt: range.to } } });
    if (periodGroups.length === 0) {
      const empty: CustomerAnalyticsResponse = { range, activeCustomersCount: 0, newCustomersCount: 0, returningCustomersCount: 0, averageLifetimeValueMinor: 0, averageOrderFrequency: 0 };
      await this.cache.set(cacheKey, empty, 300);
      return empty;
    }
    const customerIds = periodGroups.map((g) => g.customerId);

    const allTimeGroups = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { ...dims, customerId: { in: customerIds } },
      _min: { createdAt: true },
      _count: { _all: true },
      _sum: { totalMinor: true },
    });

    let newCustomersCount = 0;
    let returningCustomersCount = 0;
    let totalLifetimeValueMinor = 0;
    let totalOrdersAllTime = 0;
    for (const g of allTimeGroups) {
      const firstOrderAt = g._min.createdAt as Date;
      if (firstOrderAt.getTime() >= range.from.getTime() && firstOrderAt.getTime() < range.to.getTime()) newCustomersCount++;
      if (g._count._all >= 2) returningCustomersCount++;
      totalLifetimeValueMinor += g._sum.totalMinor ?? 0;
      totalOrdersAllTime += g._count._all;
    }

    const activeCustomersCount = allTimeGroups.length;
    const response: CustomerAnalyticsResponse = {
      range,
      activeCustomersCount,
      newCustomersCount,
      returningCustomersCount,
      averageLifetimeValueMinor: activeCustomersCount > 0 ? Math.round(totalLifetimeValueMinor / activeCustomersCount) : 0,
      averageOrderFrequency: activeCustomersCount > 0 ? Math.round((totalOrdersAllTime / activeCustomersCount) * 100) / 100 : 0,
    };
    await this.cache.set(cacheKey, response, 300);
    return response;
  }
}
