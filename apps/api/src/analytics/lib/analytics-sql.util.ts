import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";

export interface CreatorRevenueRow {
  creatorId: string;
  ordersCount: number;
  revenueMinor: number;
}

// The one place this domain needs a real SQL JOIN rather than Prisma's single-table `groupBy`:
// creator attribution lives on `Attribution`, but order value lives on `Order` — grouping "revenue
// per creator" needs both in the same GROUP BY, which Prisma's ORM-level groupBy cannot express
// across a relation. Every other cross-entity breakdown in this domain groups by a column that
// already lives directly on `Order` (`offerId`, `campaignId`) and uses native `prisma.order.
// groupBy` instead — see executive/campaign/product-analytics.service.ts. Parameterized via
// `Prisma.sql`/`Prisma.join` (never string-concatenated), so this carries no injection risk despite
// being raw SQL.
export async function creatorRevenueBreakdown(
  prisma: PrismaService,
  params: { from: Date; to: Date; paidStatuses: readonly string[]; campaignId?: string; creatorId?: string },
): Promise<CreatorRevenueRow[]> {
  const conditions = [
    Prisma.sql`a."createdAt" >= ${params.from}`,
    Prisma.sql`a."createdAt" < ${params.to}`,
    Prisma.sql`o."status"::text = ANY(${params.paidStatuses})`,
  ];
  if (params.campaignId) conditions.push(Prisma.sql`a."campaignId" = ${params.campaignId}`);
  if (params.creatorId) conditions.push(Prisma.sql`a."creatorId" = ${params.creatorId}`);

  const rows = await prisma.$queryRaw<{ creatorId: string; ordersCount: bigint; revenueMinor: bigint | null }[]>(
    Prisma.sql`
      SELECT a."creatorId" as "creatorId",
             COUNT(DISTINCT o.id)::bigint as "ordersCount",
             COALESCE(SUM(o."totalMinor"), 0)::bigint as "revenueMinor"
      FROM "Attribution" a
      JOIN "Order" o ON o.id = a."orderId"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY a."creatorId"
      ORDER BY "revenueMinor" DESC
    `,
  );
  return rows.map((r) => ({ creatorId: r.creatorId, ordersCount: Number(r.ordersCount), revenueMinor: Number(r.revenueMinor ?? 0) }));
}

export interface DailyTrendRow {
  day: Date;
  ordersCount: number;
  revenueMinor: number;
}

// Daily-bucketed trend for the Executive Dashboard's trend chart and the Campaign/Product detail
// pages' "time trends" requirement. `date_trunc` grouping isn't expressible through Prisma's
// ORM-level `groupBy` (it only groups by literal columns), so this is the second and only other
// place this domain uses raw SQL — same Prisma.sql/Prisma.join parameterization as
// creatorRevenueBreakdown above.
export async function dailyOrderTrend(
  prisma: PrismaService,
  params: { from: Date; to: Date; paidStatuses: readonly string[]; campaignId?: string; offerIds?: string[] },
): Promise<DailyTrendRow[]> {
  const conditions = [
    Prisma.sql`o."createdAt" >= ${params.from}`,
    Prisma.sql`o."createdAt" < ${params.to}`,
    Prisma.sql`o."status"::text = ANY(${params.paidStatuses})`,
  ];
  if (params.campaignId) conditions.push(Prisma.sql`o."campaignId" = ${params.campaignId}`);
  if (params.offerIds && params.offerIds.length > 0) conditions.push(Prisma.sql`o."offerId" IN (${Prisma.join(params.offerIds)})`);

  const rows = await prisma.$queryRaw<{ day: Date; ordersCount: bigint; revenueMinor: bigint | null }[]>(
    Prisma.sql`
      SELECT date_trunc('day', o."createdAt") as day,
             COUNT(*)::bigint as "ordersCount",
             COALESCE(SUM(o."totalMinor"), 0)::bigint as "revenueMinor"
      FROM "Order" o
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY day
      ORDER BY day
    `,
  );
  return rows.map((r) => ({ day: r.day, ordersCount: Number(r.ordersCount), revenueMinor: Number(r.revenueMinor ?? 0) }));
}

export interface OfferRefundRow {
  offerId: string;
  refundedOrdersCount: number;
  refundsMinor: number;
}

// Third and last raw-SQL join in this domain: `Refund` has no `offerId` of its own (only
// `Order` does), so a per-product refund breakdown needs the same JOIN reasoning as
// creatorRevenueBreakdown above rather than Prisma's single-table groupBy.
export async function refundBreakdownByOffer(
  prisma: PrismaService,
  params: { from: Date; to: Date; decidedStatuses: readonly string[]; offerIds?: string[] },
): Promise<OfferRefundRow[]> {
  const conditions = [
    Prisma.sql`r."status"::text = ANY(${params.decidedStatuses})`,
    Prisma.sql`r."createdAt" >= ${params.from}`,
    Prisma.sql`r."createdAt" < ${params.to}`,
  ];
  if (params.offerIds && params.offerIds.length > 0) conditions.push(Prisma.sql`o."offerId" IN (${Prisma.join(params.offerIds)})`);

  const rows = await prisma.$queryRaw<{ offerId: string; refundedOrdersCount: bigint; refundsMinor: bigint | null }[]>(
    Prisma.sql`
      SELECT o."offerId" as "offerId",
             COUNT(DISTINCT r."orderId")::bigint as "refundedOrdersCount",
             COALESCE(SUM(r."amountMinor"), 0)::bigint as "refundsMinor"
      FROM "Refund" r
      JOIN "Order" o ON o.id = r."orderId"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY o."offerId"
    `,
  );
  return rows.map((r) => ({ offerId: r.offerId, refundedOrdersCount: Number(r.refundedOrdersCount), refundsMinor: Number(r.refundsMinor ?? 0) }));
}
