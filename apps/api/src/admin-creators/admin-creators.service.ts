import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { ReferralsService, type ReferralSummaryResponse } from "../referrals/referrals.service";
import type { CreatorQueryDto } from "./dto/creator-query.dto";

const CREATOR_LIST_SELECT = {
  id: true,
  displayName: true,
  city: true,
  createdAt: true,
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

  private toListItem(row: CreatorListRow): CreatorAdminListItem {
    const app = row.applications[0];
    return {
      id: row.id,
      displayName: row.displayName,
      email: row.user.email,
      phone: row.user.phone,
      city: row.city,
      createdAt: row.createdAt,
      accountStatus: row.user.status,
      onboardingStatus: app?.status ?? "DRAFT",
    };
  }

  async list(query: CreatorQueryDto): Promise<PaginatedResult<CreatorAdminListItem>> {
    const where: Prisma.CreatorProfileWhereInput = {
      user: { status: query.accountStatus },
      ...(query.onboardingStatus ? { applications: { some: { status: query.onboardingStatus } } } : {}),
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
    return paginate(items.map((r) => this.toListItem(r)), total, query);
  }

  private async findRowOrThrow(id: string): Promise<CreatorListRow & { applications: { currentStep: number; submittedAt: Date | null; reviewedAt: Date | null; status: string }[] }> {
    const row = await this.prisma.creatorProfile.findUnique({ where: { id }, select: CREATOR_LIST_SELECT });
    if (!row) throw new DomainException("NOT_FOUND", "Creator topilmadi.");
    return row;
  }

  async findOneOrThrow(id: string): Promise<CreatorAdminDetail> {
    const row = await this.findRowOrThrow(id);
    const app = row.applications[0];
    return {
      ...this.toListItem(row),
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
}
