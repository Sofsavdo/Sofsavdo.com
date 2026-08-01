import type { PrismaService } from "../prisma/prisma.service";
import type { DateRange } from "../analytics/lib/time-range.resolver";

export interface RankedCreator {
  creatorId: string;
  displayName: string;
  commissionMinor: number;
  ordersCount: number;
}

// Shared by CreatorLeaderboardService (always "this_month") and CompetitionsService (an arbitrary
// admin-chosen date window) — both rank creators the same way, so the ranking query itself lives
// in exactly one place rather than being copy-pasted with a different `where` each time. Single-
// table groupBy, no raw SQL needed (creatorId is direct on Commission, unlike Attribution/Order's
// relation — see CreatorAnalyticsService.list() for the raw-SQL case this domain does NOT need).
export async function rankCreatorsByCommission(prisma: PrismaService, range: DateRange): Promise<RankedCreator[]> {
  const rows = await prisma.commission.groupBy({
    by: ["creatorId"],
    where: { createdAt: { gte: range.from, lt: range.to }, status: { notIn: ["REJECTED", "REFUNDED"] } },
    _sum: { amountMinor: true },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const profiles = await prisma.creatorProfile.findMany({
    where: { id: { in: rows.map((r) => r.creatorId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(profiles.map((p) => [p.id, p.displayName]));

  return rows
    .map((r) => ({
      creatorId: r.creatorId,
      displayName: nameById.get(r.creatorId) ?? "Creator",
      commissionMinor: r._sum.amountMinor ?? 0,
      ordersCount: r._count._all,
    }))
    .sort((a, b) => b.commissionMinor - a.commissionMinor);
}

// Rank creators by order count within a date range
export async function rankCreatorsByOrderCount(prisma: PrismaService, range: DateRange): Promise<RankedCreator[]> {
  const rows = await prisma.commission.groupBy({
    by: ["creatorId"],
    where: { createdAt: { gte: range.from, lt: range.to }, status: { notIn: ["REJECTED", "REFUNDED"] } },
    _count: { _all: true },
    _sum: { amountMinor: true },
  });
  if (rows.length === 0) return [];

  const profiles = await prisma.creatorProfile.findMany({
    where: { id: { in: rows.map((r) => r.creatorId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(profiles.map((p) => [p.id, p.displayName]));

  return rows
    .map((r) => ({
      creatorId: r.creatorId,
      displayName: nameById.get(r.creatorId) ?? "Creator",
      commissionMinor: r._sum.amountMinor ?? 0,
      ordersCount: r._count._all,
    }))
    .sort((a, b) => b.ordersCount - a.ordersCount);
}

// Rank creators by referral count within a date range
export async function rankCreatorsByReferralCount(prisma: PrismaService, range: DateRange): Promise<RankedCreator[]> {
  const rows = await prisma.creatorReferral.groupBy({
    by: ["referrerCreatorId"],
    where: { registeredAt: { gte: range.from, lt: range.to } },
    _count: { _all: true },
  });
  if (rows.length === 0) return [];

  const profiles = await prisma.creatorProfile.findMany({
    where: { id: { in: rows.map((r) => r.referrerCreatorId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(profiles.map((p) => [p.id, p.displayName]));

  return rows
    .map((r) => ({
      creatorId: r.referrerCreatorId,
      displayName: nameById.get(r.referrerCreatorId) ?? "Creator",
      commissionMinor: 0,
      ordersCount: r._count._all,
    }))
    .sort((a, b) => b.ordersCount - a.ordersCount);
}
