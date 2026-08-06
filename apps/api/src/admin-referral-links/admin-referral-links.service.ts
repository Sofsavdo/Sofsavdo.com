import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ReferralLinkStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { PAID_ORDER_STATUSES } from "../analytics/lib/analytics-filters.util";

// The `/admin/referral-links` page's real backend — previously a bare mock re-export with zero
// USE_REAL_API gating at all (see DECISIONS.md ADR-031).
export interface AdminReferralLinkResponse {
  code: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  offerName: string;
  clicks: number;
  orders: number;
  revenueMinor: number;
  status: ReferralLinkStatus;
}

interface LinkStatsRow {
  linkId: string;
  clicks: bigint;
  orders: bigint;
  revenueMinor: bigint | null;
}

// Same "cap a flat, non-paginated admin list response" convention as AdminVisitorsService's
// VISITORS_LIMIT — this endpoint has no `take`/`skip` at all today, so it returns every
// ReferralLink ever created on every single page load, unbounded and only growing.
const REFERRAL_LINKS_LIMIT = 200;

@Injectable()
export class AdminReferralLinksService {
  constructor(private prisma: PrismaService) {}

  async list(): Promise<AdminReferralLinkResponse[]> {
    const [links, statsRows] = await Promise.all([
      this.prisma.referralLink.findMany({
        orderBy: { createdAt: "desc" },
        take: REFERRAL_LINKS_LIMIT,
        include: { creator: { select: { displayName: true } }, campaign: { select: { name: true } }, offer: { select: { name: true } } },
      }),
      this.clickAndRevenueByLink(),
    ]);
    const statsByLink = new Map(statsRows.map((r) => [r.linkId, r]));

    return links.map((l) => {
      const stats = statsByLink.get(l.id);
      return {
        code: l.code,
        creatorId: l.creatorId,
        creatorName: l.creator.displayName,
        campaignId: l.campaignId,
        campaignName: l.campaign.name,
        offerName: l.offer.name,
        clicks: stats ? Number(stats.clicks) : 0,
        orders: stats ? Number(stats.orders) : 0,
        revenueMinor: stats ? Number(stats.revenueMinor ?? 0) : 0,
        status: l.status,
      };
    });
  }

  // Raw SQL for the same reason analytics-sql.util.ts's helpers are raw — clicks/orders/revenue
  // per link needs a 3-table JOIN (ReferralLink -> ReferralVisit -> Attribution -> Order) that
  // Prisma's ORM-level groupBy cannot express across relations this deep.
  private async clickAndRevenueByLink(): Promise<LinkStatsRow[]> {
    return this.prisma.$queryRaw<LinkStatsRow[]>(
      Prisma.sql`
        SELECT rl.id as "linkId",
               COUNT(DISTINCT rv.id)::bigint as clicks,
               COUNT(DISTINCT a."orderId")::bigint as orders,
               COALESCE(SUM(o."totalMinor"), 0)::bigint as "revenueMinor"
        FROM "ReferralLink" rl
        LEFT JOIN "ReferralVisit" rv ON rv."referralLinkId" = rl.id
        LEFT JOIN "Attribution" a ON a."referralVisitId" = rv.id
        LEFT JOIN "Order" o ON o.id = a."orderId" AND o.status::text = ANY(${[...PAID_ORDER_STATUSES]})
        GROUP BY rl.id
      `,
    );
  }

  // Returns just the updated row's own fields (status/creator/campaign/offer), not recomputed
  // clicks/orders/revenue — the caller's mutation invalidates and refetches the full list anyway
  // (see useDeactivateReferralLink), so redoing the whole-table stats JOIN here for a single
  // status flip would be pure waste.
  async deactivate(code: string): Promise<Pick<AdminReferralLinkResponse, "code" | "creatorName" | "campaignName" | "offerName" | "status">> {
    const existing = await this.prisma.referralLink.findUnique({
      where: { code },
      include: { creator: { select: { displayName: true } }, campaign: { select: { name: true } }, offer: { select: { name: true } } },
    });
    if (!existing) throw new DomainException("REFERRAL_NOT_FOUND", "Referral havola topilmadi.");
    const updated = await this.prisma.referralLink.update({
      where: { code },
      data: { status: "PAUSED" },
      include: { creator: { select: { displayName: true } }, campaign: { select: { name: true } }, offer: { select: { name: true } } },
    });
    return {
      code: updated.code,
      creatorName: updated.creator.displayName,
      campaignName: updated.campaign.name,
      offerName: updated.offer.name,
      status: updated.status,
    };
  }
}
