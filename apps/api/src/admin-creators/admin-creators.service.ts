import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type UserStatus, type BioComplianceStatus, type CreatorTier } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { ReferralsService, type ReferralSummaryResponse } from "../referrals/referrals.service";
import type { CreatorQueryDto } from "./dto/creator-query.dto";
import { classifyCreatorActivity, NEW_GRACE_DAYS, type CreatorActivityStatus } from "./creator-activity";

const CREATOR_LIST_SELECT = {
  id: true,
  displayName: true,
  city: true,
  createdAt: true,
  bioComplianceStatus: true,
  tier: true,
  user: { select: { id: true, email: true, phone: true, status: true } },
  applications: { orderBy: { createdAt: "desc" as const }, take: 1, select: { status: true, currentStep: true, submittedAt: true, reviewedAt: true } },
} satisfies Prisma.CreatorProfileSelect;

type CreatorListRow = Prisma.CreatorProfileGetPayload<{ select: typeof CREATOR_LIST_SELECT }>;

export interface CreatorAdminListItem {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  createdAt: Date;
  accountStatus: UserStatus;
  onboardingStatus: string;
  bioComplianceStatus: BioComplianceStatus;
  tier: CreatorTier;
  // Flow-centric engagement — see creator-activity.ts. Lets an admin spot who registered and
  // stopped (NO_FLOW), took a Flow but isn't sharing it (FLOW_NO_CLICKS), etc., and reach out.
  activityStatus: CreatorActivityStatus;
  flowCount: number;
  totalClicks: number;
  totalOrders: number;
  totalEarnedMinor: number;
  lastActivityAt: Date;
}

interface FlowAggregate {
  flowCount: number;
  totalClicks: number;
  totalOrders: number;
  totalEarnedMinor: number;
  lastActivityAt: Date | undefined;
}

export interface CreatorActivitySummary {
  total: number;
  newCount: number;
  noFlow: number;
  flowNoClicks: number;
  activeNoEarnings: number;
  earning: number;
  tookFlow: number;
}

// Not-earning is the shared negation used by several activity filters — a creator counts as earning
// the moment any Flow has a real order or accrued commission.
const NOT_EARNING: Prisma.CreatorProfileWhereInput = {
  NOT: { flows: { some: { OR: [{ orderCount: { gt: 0 } }, { commissionEarnedMinor: { gt: 0 } }] } } },
};

// Prisma relation filter matching classifyCreatorActivity for a given status, so the paginated
// list filter and the displayed badge never disagree. `graceThreshold` = now - NEW_GRACE_DAYS.
function activityWhere(status: CreatorActivityStatus, graceThreshold: Date): Prisma.CreatorProfileWhereInput {
  switch (status) {
    case "EARNING":
      return { flows: { some: { OR: [{ orderCount: { gt: 0 } }, { commissionEarnedMinor: { gt: 0 } }] } } };
    case "ACTIVE_NO_EARNINGS":
      return { AND: [{ flows: { some: { clickCount: { gt: 0 } } } }, NOT_EARNING] };
    case "FLOW_NO_CLICKS":
      return { AND: [{ flows: { some: {} } }, { NOT: { flows: { some: { clickCount: { gt: 0 } } } } }, NOT_EARNING] };
    case "NO_FLOW":
      return { AND: [{ flows: { none: {} } }, { createdAt: { lt: graceThreshold } }] };
    case "NEW":
      return { AND: [{ flows: { none: {} } }, { createdAt: { gte: graceThreshold } }] };
  }
}

export interface CreatorAdminDetail extends CreatorAdminListItem {
  onboardingCurrentStep: number;
  onboardingSubmittedAt: Date | null;
  onboardingReviewedAt: Date | null;
  // "Verified" means the onboarding application has been reviewed and approved — the same fact
  // RequireCreatorGuard checks (see require-creator.guard.ts) — surfaced here for the admin, not a
  // second independent verification concept.
  verified: boolean;
}

export interface CampaignHistoryItem {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  status: string;
  joinedAt: Date;
  endedAt: Date | null;
}

export interface EarningsSummary {
  pendingMinor: number;
  approvedMinor: number;
  payableMinor: number;
  paidMinor: number;
  rejectedMinor: number;
  refundedMinor: number;
  currency: string;
}

export interface PayoutSummary {
  requestedMinor: number;
  approvedMinor: number;
  processingMinor: number;
  paidMinor: number;
  rejectedMinor: number;
  failedMinor: number;
  currency: string;
}

const SUSPEND_FROM: UserStatus[] = ["ACTIVE"];
const UNSUSPEND_FROM: UserStatus[] = ["SUSPENDED"];
const BLOCK_FROM: UserStatus[] = ["ACTIVE", "SUSPENDED"];
const UNBLOCK_FROM: UserStatus[] = ["BLOCKED"];

// Real admin creator-account administration (Phase 12) — distinct from CreatorProfileService
// (creator's own session bootstrap) and from onboarding/onboarding.service.ts (the application
// review workflow, Phase 11, already complete). This module only reads pre-existing domains
// (CreatorProfile, CreatorApplication, Commission, Payout, CreatorReferral via ReferralsService)
// and mutates only `User.status` — no other domain's tables are written here. See DECISIONS.md
// ADR-019.
@Injectable()
export class AdminCreatorsService {
  constructor(
    private prisma: PrismaService,
    private referrals: ReferralsService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  // The activity fields need per-creator Flow aggregates, fetched separately (see list()); a row
  // with no Flow rows simply isn't in the aggregate map, so it reads as zero activity.
  private toListItem(row: CreatorListRow, agg: FlowAggregate | undefined, now: Date): CreatorAdminListItem {
    const app = row.applications[0];
    const flowCount = agg?.flowCount ?? 0;
    const totalClicks = agg?.totalClicks ?? 0;
    const totalOrders = agg?.totalOrders ?? 0;
    const totalEarnedMinor = agg?.totalEarnedMinor ?? 0;
    return {
      id: row.id,
      displayName: row.displayName,
      email: row.user.email,
      phone: row.user.phone,
      city: row.city,
      createdAt: row.createdAt,
      accountStatus: row.user.status,
      onboardingStatus: app?.status ?? "DRAFT",
      bioComplianceStatus: row.bioComplianceStatus,
      tier: row.tier,
      activityStatus: classifyCreatorActivity({ now, registeredAt: row.createdAt, flowCount, totalClicks, totalOrders, totalEarnedMinor }),
      flowCount,
      totalClicks,
      totalOrders,
      totalEarnedMinor,
      // For a creator with no Flow, "last activity" is their registration — the timestamp the admin
      // measures dormancy against either way.
      lastActivityAt: agg?.lastActivityAt ?? row.createdAt,
    };
  }

  async list(query: CreatorQueryDto): Promise<PaginatedResult<CreatorAdminListItem>> {
    const now = new Date();
    const graceThreshold = new Date(now.getTime() - NEW_GRACE_DAYS * 86_400_000);
    const where: Prisma.CreatorProfileWhereInput = {
      user: { status: query.accountStatus },
      ...(query.onboardingStatus ? { applications: { some: { status: query.onboardingStatus } } } : {}),
      ...(query.activityStatus ? activityWhere(query.activityStatus, graceThreshold) : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.creatorProfile.findMany({ where, select: CREATOR_LIST_SELECT, orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.creatorProfile.count({ where }),
    ]);
    const aggregates = await this.fetchFlowAggregates(items.map((r) => r.id));
    return paginate(items.map((r) => this.toListItem(r, aggregates.get(r.id), now)), total, query);
  }

  // One grouped query for the whole page's creators — turns what would be an N+1 (one flow query
  // per creator) into a single round-trip, the same batching discipline used across the codebase.
  private async fetchFlowAggregates(creatorIds: string[]): Promise<Map<string, FlowAggregate>> {
    if (creatorIds.length === 0) return new Map();
    const rows = await this.prisma.flow.groupBy({
      by: ["creatorProfileId"],
      where: { creatorProfileId: { in: creatorIds } },
      _count: { _all: true },
      _sum: { clickCount: true, orderCount: true, commissionEarnedMinor: true },
      _max: { updatedAt: true },
    });
    return new Map(
      rows.map((r) => [
        r.creatorProfileId,
        {
          flowCount: r._count._all,
          totalClicks: r._sum.clickCount ?? 0,
          totalOrders: r._sum.orderCount ?? 0,
          totalEarnedMinor: r._sum.commissionEarnedMinor ?? 0,
          lastActivityAt: r._max.updatedAt ?? undefined,
        },
      ]),
    );
  }

  // Funnel snapshot for the top of the admin creators page — global counts, not affected by the
  // list's search/filter, so it always shows the whole picture. Each count reuses the same
  // activityWhere() predicates the per-row badge and filter use, so the tiles and the filtered list
  // agree by construction.
  async getActivitySummary(): Promise<CreatorActivitySummary> {
    const graceThreshold = new Date(Date.now() - NEW_GRACE_DAYS * 86_400_000);
    const count = (where: Prisma.CreatorProfileWhereInput) => this.prisma.creatorProfile.count({ where });
    const [total, newCount, noFlow, flowNoClicks, activeNoEarnings, earning] = await Promise.all([
      count({}),
      count(activityWhere("NEW", graceThreshold)),
      count(activityWhere("NO_FLOW", graceThreshold)),
      count(activityWhere("FLOW_NO_CLICKS", graceThreshold)),
      count(activityWhere("ACTIVE_NO_EARNINGS", graceThreshold)),
      count(activityWhere("EARNING", graceThreshold)),
    ]);
    return { total, newCount, noFlow, flowNoClicks, activeNoEarnings, earning, tookFlow: flowNoClicks + activeNoEarnings + earning };
  }

  private async findRowOrThrow(id: string): Promise<CreatorListRow & { applications: { currentStep: number; submittedAt: Date | null; reviewedAt: Date | null; status: string }[] }> {
    const row = await this.prisma.creatorProfile.findUnique({ where: { id }, select: CREATOR_LIST_SELECT });
    if (!row) throw new DomainException("NOT_FOUND", "Creator topilmadi.");
    return row;
  }

  async findOneOrThrow(id: string): Promise<CreatorAdminDetail> {
    const row = await this.findRowOrThrow(id);
    const app = row.applications[0];
    const aggregates = await this.fetchFlowAggregates([row.id]);
    return {
      ...this.toListItem(row, aggregates.get(row.id), new Date()),
      onboardingCurrentStep: app?.currentStep ?? 1,
      onboardingSubmittedAt: app?.submittedAt ?? null,
      onboardingReviewedAt: app?.reviewedAt ?? null,
      verified: app?.status === "APPROVED",
    };
  }

  async getCampaignHistory(id: string): Promise<CampaignHistoryItem[]> {
    await this.findRowOrThrow(id);
    const rows = await this.prisma.creatorCampaign.findMany({
      where: { creatorId: id },
      orderBy: { joinedAt: "desc" },
      include: { campaign: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      campaignSlug: r.campaign.slug,
      status: r.status,
      joinedAt: r.joinedAt,
      endedAt: r.endedAt,
    }));
  }

  async getEarningsSummary(id: string): Promise<EarningsSummary> {
    await this.findRowOrThrow(id);
    const rows = await this.prisma.commission.groupBy({ by: ["status"], where: { creatorId: id }, _sum: { amountMinor: true } });
    const byStatus = new Map(rows.map((r) => [r.status, r._sum.amountMinor ?? 0]));
    return {
      pendingMinor: byStatus.get("PENDING") ?? 0,
      approvedMinor: byStatus.get("APPROVED") ?? 0,
      payableMinor: byStatus.get("PAYABLE") ?? 0,
      paidMinor: byStatus.get("PAID") ?? 0,
      rejectedMinor: byStatus.get("REJECTED") ?? 0,
      refundedMinor: byStatus.get("REFUNDED") ?? 0,
      currency: "UZS",
    };
  }

  async getPayoutSummary(id: string): Promise<PayoutSummary> {
    await this.findRowOrThrow(id);
    const rows = await this.prisma.payout.groupBy({ by: ["status"], where: { creatorId: id }, _sum: { amountMinor: true } });
    const byStatus = new Map(rows.map((r) => [r.status, r._sum.amountMinor ?? 0]));
    return {
      requestedMinor: byStatus.get("REQUESTED") ?? 0,
      approvedMinor: byStatus.get("APPROVED") ?? 0,
      processingMinor: byStatus.get("PROCESSING") ?? 0,
      paidMinor: byStatus.get("PAID") ?? 0,
      rejectedMinor: byStatus.get("REJECTED") ?? 0,
      failedMinor: byStatus.get("FAILED") ?? 0,
      currency: "UZS",
    };
  }

  async getReferralSummary(id: string): Promise<ReferralSummaryResponse> {
    await this.findRowOrThrow(id);
    return this.referrals.getMySummary(id, this.config.get<string>("webAppUrl")!);
  }

  private async transitionAccountStatus(id: string, to: UserStatus, fromStatuses: UserStatus[], action: string, actorId: string, reason?: string): Promise<CreatorAdminDetail> {
    const row = await this.findRowOrThrow(id);
    if (!fromStatuses.includes(row.user.status)) {
      throw new DomainException("VALIDATION_ERROR", "Hisob holati bu amal uchun mos emas.", { from: row.user.status, action });
    }
    await this.prisma.user.update({ where: { id: row.user.id }, data: { status: to } });
    await this.audit.record({ actorId, action, entityType: "User", entityId: row.user.id, before: { status: row.user.status }, after: { status: to, reason } });
    return this.findOneOrThrow(id);
  }

  suspend(id: string, actorId: string, reason: string) {
    return this.transitionAccountStatus(id, "SUSPENDED", SUSPEND_FROM, "CREATOR_SUSPENDED", actorId, reason);
  }

  unsuspend(id: string, actorId: string) {
    return this.transitionAccountStatus(id, "ACTIVE", UNSUSPEND_FROM, "CREATOR_UNSUSPENDED", actorId);
  }

  block(id: string, actorId: string, reason: string) {
    return this.transitionAccountStatus(id, "BLOCKED", BLOCK_FROM, "CREATOR_BLOCKED", actorId, reason);
  }

  unblock(id: string, actorId: string) {
    return this.transitionAccountStatus(id, "ACTIVE", UNBLOCK_FROM, "CREATOR_UNBLOCKED", actorId);
  }

  // Phase Q — a manual admin spot-check (no automated bio-scraping exists, see DECISIONS.md
  // ADR-034), not a state-machine transition: any status can be reset to any other at any time
  // (a creator can update their bio after being marked NON_COMPLIANT, an admin re-checks and marks
  // COMPLIANT again), so this has no ALLOWED_FROM guard the way suspend/block do.
  async setBioCompliance(id: string, status: BioComplianceStatus, actorId: string): Promise<CreatorAdminDetail> {
    const row = await this.findRowOrThrow(id);
    await this.prisma.creatorProfile.update({ where: { id }, data: { bioComplianceStatus: status } });
    await this.audit.record({
      actorId,
      action: "CREATOR_BIO_COMPLIANCE_SET",
      entityType: "CreatorProfile",
      entityId: id,
      before: { bioComplianceStatus: row.bioComplianceStatus },
      after: { bioComplianceStatus: status },
    });
    return this.findOneOrThrow(id);
  }

  // Grants/revokes the Premium exemption — see PayoutsService.requestPayout's own comment for
  // what this actually changes (STANDARD + NON_COMPLIANT blocks new payout requests; PREMIUM never
  // does, regardless of bioComplianceStatus).
  async setTier(id: string, tier: CreatorTier, actorId: string): Promise<CreatorAdminDetail> {
    const row = await this.findRowOrThrow(id);
    await this.prisma.creatorProfile.update({ where: { id }, data: { tier } });
    await this.audit.record({
      actorId,
      action: "CREATOR_TIER_SET",
      entityType: "CreatorProfile",
      entityId: id,
      before: { tier: row.tier },
      after: { tier },
    });
    return this.findOneOrThrow(id);
  }
}
