import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import { DECIDED_REFUND_STATUSES } from "./lib/analytics-filters.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

const VALID_PAYMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];

export interface PaymentAnalyticsResponse {
  range: { from: Date; to: Date };
  totalCount: number;
  successRate: number;
  byMethod: Array<{ provider: string; count: number; amountMinor: number }>;
  pendingCount: number;
  failedCount: number;
  refundsMinor: number;
}

@Injectable()
export class PaymentAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getSummary(query: AnalyticsQueryDto): Promise<PaymentAnalyticsResponse> {
    if (query.status && !VALID_PAYMENT_STATUSES.includes(query.status)) {
      throw new DomainException("VALIDATION_ERROR", "Noto'g'ri to'lov statusi.", { status: query.status });
    }

    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("payments", { query, resolved });
    const cached = await this.cache.get<PaymentAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const range = resolved.current;
    const where: Prisma.PaymentWhereInput = { createdAt: { gte: range.from, lt: range.to } };
    if (query.status) where.status = query.status as Prisma.EnumPaymentStatusFilter["equals"];
    if (query.campaignId || query.productId || query.creatorId || query.region) {
      where.order = {
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.productId ? { offer: { productId: query.productId } } : {}),
        ...(query.region ? { address: { region: { contains: query.region, mode: "insensitive" } } } : {}),
        ...(query.creatorId ? { attribution: { creatorId: query.creatorId } } : {}),
      };
    }

    const [statusGroups, refundGroups] = await Promise.all([
      this.prisma.payment.groupBy({ by: ["provider", "status"], where, _count: { _all: true }, _sum: { amountMinor: true } }),
      this.prisma.refund.groupBy({ by: ["status"], where: { createdAt: { gte: range.from, lt: range.to } }, _sum: { amountMinor: true } }),
    ]);

    const byMethodMap = new Map<string, { count: number; amountMinor: number }>();
    let totalCount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    for (const g of statusGroups) {
      totalCount += g._count._all;
      if (g.status === "PAID") paidCount += g._count._all;
      if (g.status === "PENDING" || g.status === "PROCESSING") pendingCount += g._count._all;
      if (g.status === "FAILED") failedCount += g._count._all;
      const cur = byMethodMap.get(g.provider) ?? { count: 0, amountMinor: 0 };
      cur.count += g._count._all;
      cur.amountMinor += g._sum.amountMinor ?? 0;
      byMethodMap.set(g.provider, cur);
    }

    const refundsMinor = refundGroups.filter((g) => (DECIDED_REFUND_STATUSES as readonly string[]).includes(g.status)).reduce((acc, g) => acc + (g._sum.amountMinor ?? 0), 0);

    const response: PaymentAnalyticsResponse = {
      range,
      totalCount,
      successRate: totalCount > 0 ? paidCount / totalCount : 0,
      byMethod: [...byMethodMap.entries()].map(([provider, m]) => ({ provider, ...m })),
      pendingCount,
      failedCount,
      refundsMinor,
    };
    await this.cache.set(cacheKey, response, 300);
    return response;
  }
}
