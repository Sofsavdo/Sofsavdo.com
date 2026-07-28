import type { Prisma } from "@prisma/client";
import type { AnalyticsQueryDto } from "../dto/analytics-query.dto";

// Shared global-filter application (§14 of ANALYTICS.md). Deliberately excludes `paymentMethod`
// and `status` — paymentMethod means a different relation path depending on which table is the
// query root (Order.payment.provider vs. Payment.provider directly), and status means a different
// enum per view (OrderStatus/PaymentStatus/RefundStatus) — both are applied directly by each
// sub-service instead of through this shared helper, to avoid a leaky abstraction that only works
// for one of the two shapes.
export function buildOrderDimensionFilters(query: Pick<AnalyticsQueryDto, "campaignId" | "productId" | "region" | "creatorId">): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (query.campaignId) where.campaignId = query.campaignId;
  if (query.productId) where.offer = { productId: query.productId };
  if (query.region) where.address = { region: { contains: query.region, mode: "insensitive" } };
  if (query.creatorId) where.attribution = { creatorId: query.creatorId };
  return where;
}

export const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "REFUNDED"] as const;
export const REVENUE_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"] as const;
export const PENDING_ORDER_STATUSES = ["CREATED", "PAYMENT_PENDING"] as const;
export const DECIDED_REFUND_STATUSES = ["APPROVED", "PROCESSED"] as const;
