import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// The `/admin/visitors` page's real backend — previously a bare mock re-export with zero
// USE_REAL_API gating, and one whose mock data was itself synthesized from *other* mock data
// (fabricated visit counts derived from fake referral-link stats, with `fraudRiskFlags` randomly
// seeded on every 11th row) — see DECISIONS.md ADR-031.
//
// `source`/`fraudRiskFlags` are deliberately honest here, not faked to match the old mock's shape:
// a ReferralVisit is recorded identically whether it came from a promo code or a referral link —
// "source" is only ever knowable once (if) that visit produces a real Attribution, so it's `null`
// until then rather than a guessed default. `fraudRiskFlags` is always `[]` — no real fraud
// detection exists yet (already a disclosed, pre-existing gap — see PRODUCTION_READINESS.md's
// "Fraud detection... explicitly out of scope for every phase so far"), so this returns the
// honest empty array instead of inventing flags nobody is actually computing.
export interface AdminVisitorResponse {
  id: string;
  visitorId: string;
  offerName: string;
  campaignName: string | null;
  creatorName: string | null;
  source: "PROMO_CODE" | "REFERRAL_VISIT" | "FLOW" | "MANUAL" | null;
  landingPage: string;
  createdAt: Date;
  expiresAt: Date;
  attributedOrderToken: string | null;
  fraudRiskFlags: string[];
}

const VISITORS_LIMIT = 200;

@Injectable()
export class AdminVisitorsService {
  constructor(private prisma: PrismaService) {}

  async list(): Promise<AdminVisitorResponse[]> {
    const rows = await this.prisma.referralVisit.findMany({
      orderBy: { createdAt: "desc" },
      take: VISITORS_LIMIT,
      include: {
        offer: { select: { name: true } },
        campaign: { select: { name: true } },
        referralLink: { select: { creator: { select: { displayName: true } } } },
        attributions: { select: { source: true, order: { select: { publicToken: true } } }, take: 1 },
      },
    });
    return rows.map((v) => {
      const attribution = v.attributions[0];
      return {
        id: v.id,
        visitorId: v.visitorId,
        offerName: v.offer.name,
        campaignName: v.campaign?.name ?? null,
        creatorName: v.referralLink?.creator.displayName ?? null,
        source: attribution?.source ?? null,
        landingPage: v.landingPage,
        createdAt: v.createdAt,
        expiresAt: v.expiresAt,
        attributedOrderToken: attribution?.order.publicToken ?? null,
        fraudRiskFlags: [],
      };
    });
  }
}
