import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import { resolveAnalyticsRange } from "./lib/time-range.resolver";
import { PAID_ORDER_STATUSES, DECIDED_REFUND_STATUSES } from "./lib/analytics-filters.util";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

const VALID_REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "REJECTED"];

export interface RefundAnalyticsResponse {
  range: { from: Date; to: Date };
  requestedCount: number;
  refundRate: number;
  approvalRate: number;
  averageRefundAmountMinor: number;
  totalRefundedMinor: number;
  // Raw `Refund.reason` strings, ranked by frequency — no taxonomy normalization yet (deferred,
  // approved scope; see ANALYTICS.md Finding #3 and DECISIONS.md ADR-020).
  topReasons: Array<{ reason: string; count: number }>;
}

@Injectable()
export class RefundAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: AnalyticsCacheService,
  ) {}

  async getSummary(query: AnalyticsQueryDto): Promise<RefundAnalyticsResponse> {
    if (query.status && !VALID_REFUND_STATUSES.includes(query.status)) {
      throw new DomainException("VALIDATION_ERROR", "Noto'g'ri refund statusi.", { status: query.status });
    }

    const resolved = resolveAnalyticsRange(query);
    const cacheKey = this.cache.buildKey("refunds", { query, resolved });
    const cached = await this.cache.get<RefundAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const range = resolved.current;
    const dimensionOrderFilter: Prisma.OrderWhereInput = {};
    if (query.campaignId) dimensionOrderFilter.campaignId = query.campaignId;
    if (query.productId) dimensionOrderFilter.offer = { productId: query.productId };
    if (query.region) dimensionOrderFilter.address = { region: { contains: query.region, mode: "insensitive" } };
    if (query.creatorId) dimensionOrderFilter.attribution = { creatorId: query.creatorId };
    const hasOrderDims = Object.keys(dimensionOrderFilter).length > 0;

    const refundWhere: Prisma.RefundWhereInput = { createdAt: { gte: range.from, lt: range.to } };
    if (query.status) refundWhere.status = query.status as Prisma.EnumRefundStatusFilter["equals"];
    if (hasOrderDims) refundWhere.order = dimensionOrderFilter;

    const paidOrderWhere: Prisma.OrderWhereInput = { status: { in: [...PAID_ORDER_STATUSES] }, createdAt: { gte: range.from, lt: range.to }, ...dimensionOrderFilter };

    const [statusGroups, reasonGroups, decidedAgg, paidOrdersCount] = await Promise.all([
      this.prisma.refund.groupBy({ by: ["status"], where: refundWhere, _count: { _all: true } }),
      this.prisma.refund.groupBy({ by: ["reason"], where: refundWhere, _count: { _all: true }, orderBy: { _count: { reason: "desc" } }, take: 10 }),
      this.prisma.refund.aggregate({ where: { ...refundWhere, status: { in: [...DECIDED_REFUND_STATUSES] } }, _avg: { amountMinor: true }, _sum: { amountMinor: true }, _count: { _all: true } }),
      this.prisma.order.count({ where: paidOrderWhere }),
    ]);

    const requestedCount = statusGroups.reduce((acc, g) => acc + g._count._all, 0);
    const approvedCount = statusGroups.find((g) => g.status === "APPROVED")?._count._all ?? 0;
    const processedCount = statusGroups.find((g) => g.status === "PROCESSED")?._count._all ?? 0;
    const rejectedCount = statusGroups.find((g) => g.status === "REJECTED")?._count._all ?? 0;
    const decidedCount = approvedCount + processedCount + rejectedCount;

    const response: RefundAnalyticsResponse = {
      range,
      requestedCount,
      refundRate: paidOrdersCount > 0 ? (decidedAgg._count._all ?? 0) / paidOrdersCount : 0,
      approvalRate: decidedCount > 0 ? (approvedCount + processedCount) / decidedCount : 0,
      averageRefundAmountMinor: Math.round(decidedAgg._avg.amountMinor ?? 0),
      totalRefundedMinor: decidedAgg._sum.amountMinor ?? 0,
      topReasons: reasonGroups.map((g) => ({ reason: g.reason, count: g._count._all })),
    };
    await this.cache.set(cacheKey, response, 300);
    return response;
  }
}
