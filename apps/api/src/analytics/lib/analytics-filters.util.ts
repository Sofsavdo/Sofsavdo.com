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

// An order that has been paid for, regardless of fulfillment stage or later refund — this is the
// set every revenue/commission-eligibility query in the codebase (admin dashboard, creator
// dashboard, campaign/product/refund analytics, admin-referral-links attribution) filters on.
// Was accidentally narrowed to just ["DELIVERED"] by an unrelated commit (150b3ade, "Simplify
// checkout and improve admin order management" — its actual diff only touched
// Payment.merchantReference/Click-callback code, never mentioning this constant), which meant
// every one of those metrics only counted an order once an admin manually marked it DELIVERED —
// invisible for the entire PAID/PROCESSING/SHIPPED/IN_TRANSIT lifespan every real order spends
// most of its life in.
export const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "REFUNDED"] as const;
export const REVENUE_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"] as const;
export const PENDING_ORDER_STATUSES = ["CREATED", "PAYMENT_PENDING"] as const;
export const DECIDED_REFUND_STATUSES = ["APPROVED", "PROCESSED"] as const;
