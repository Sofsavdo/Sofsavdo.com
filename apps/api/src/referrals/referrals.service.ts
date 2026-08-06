import { Injectable, Logger } from "@nestjs/common";
import type { CreatorReferral, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { applyBasisPoints } from "../common/money/money";
import { randomSuffix } from "../common/codes/code-generator";
import { classifyActivity, type ActivityClass } from "./activity-classification";
import type { CreateReferralRuleDto } from "./dto/create-referral-rule.dto";
import type { UpdateReferralRuleDto } from "./dto/update-referral-rule.dto";
import type { AdminReferralQueryDto } from "./dto/admin-referral-query.dto";

// Creator-to-creator referral program (6B Enhancement) — distinct from the pre-existing
// ReferralLink/ReferralVisit concept (creator→CUSTOMER sales attribution). See DECISIONS.md
// ADR-013 for the full model, and this file's bottom section for exactly what is/isn't real yet
// (no Content/Order/Commission domain exists, so several signals are structurally always empty
// today — never faked to look complete).

export interface ReferredFriendResponse {
  id: string; // CreatorReferral id
  referredCreatorId: string;
  displayName: string;
  registeredAt: Date;
  onboardingStatus: string;
  activity: ActivityClass;
  lastMeaningfulActivityAt: Date;
  campaignApplicationCount: number;
  approvedCampaignApplicationCount: number;
  contentSubmittedCount: number;
  approvedContentCount: number;
  qualifiedSaleCount: number;
  cumulativeQualifiedEarningsMinor: number;
  qualifiedAt: Date | null;
  disqualifiedAt: Date | null;
  pendingRewardMinor: number;
  approvedRewardMinor: number;
  paidRewardMinor: number;
}

export interface ReferralSummaryResponse {
  referralCode: string;
  invitationLink: string;
  totalInvited: number;
  activeCount: number; // ACTIVE_NO_EARNINGS + EARNING
  needsEncouragementCount: number; // ONBOARDING_STALLED + APPROVED_INACTIVE + DORMANT
  earningCount: number;
  pendingRewardMinor: number;
  approvedRewardMinor: number;
  paidRewardMinor: number;
  currency: string;
}

export interface ReferralRewardResponse {
  id: string;
  referralId: string;
  referredDisplayName: string;
  ruleName: string;
  status: string;
  qualifiedEarningsMinor: number | null;
  calculatedRewardMinor: number;
  currency: string;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export type ReferralRuleResponse = Awaited<ReturnType<PrismaService["creatorReferralRule"]["create"]>>;

export interface AdminReferralResponse {
  id: string;
  referrer: { id: string; displayName: string };
  referred: { id: string; displayName: string };
  referralCodeUsed: string;
  attributedAt: Date;
  registeredAt: Date;
  activity: ActivityClass;
  lastMeaningfulActivityAt: Date;
  qualifiedAt: Date | null;
  disqualifiedAt: Date | null;
  disqualificationReason: string | null;
  campaignApplicationCount: number;
  approvedCampaignApplicationCount: number;
  rewards: ReferralRewardResponse[];
}

const INVITATION_BASE_PATH = "/creator/register";

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private prisma: PrismaService) {}

  // ---- Code generation & attribution (used by AuthService.register) ----

  async generateUniqueReferralCode(tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomSuffix(8);
      const existing = await tx.creatorProfile.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!existing) return code;
    }
    throw new Error("Could not generate a unique referral code after 5 attempts");
  }

  async resolveReferrerForAttribution(
    referralCodeInput: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<{ referrerCreatorId: string; referralCodeUsed: string } | null> {
    if (!referralCodeInput) return null;
    // referralCode is generated uppercase-only (see code-generator.ts's SUFFIX_ALPHABET) — a friend
    // typing/retyping a shared code by hand (rather than clicking a link) very naturally lowercases
    // it, and this lookup was a byte-exact match, so attribution silently failed with zero error
    // shown to anyone: the new creator's registration still succeeded, their friend just never got
    // credit. Same bug class as login()'s email case-sensitivity — normalize the same way.
    //
    // customPromoCode is different: it's free-typed by the creator (updateCustomPromoCode stores
    // it exactly as entered, e.g. "nuroy15") and never forced to uppercase — matching it against
    // an uppercased input the same way referralCode is matched meant a real, live custom code
    // could never actually attribute a referral (confirmed: a creator's own lowercase code failed
    // every registration attempt that used it). Matched case-insensitively instead, so the
    // creator's stored casing is never rewritten but any casing a new registrant types still hits.
    const trimmed = referralCodeInput.trim();
    const normalizedCode = trimmed.toUpperCase();
    const referrer = await tx.creatorProfile.findFirst({
      where: {
        OR: [
          { customPromoCode: { equals: trimmed, mode: "insensitive" } },
          { referralCode: normalizedCode },
        ],
      },
      select: { id: true, referralCode: true, customPromoCode: true },
    });
    if (referrer) {
      const codeUsed = referrer.customPromoCode?.toUpperCase() === normalizedCode ? referrer.customPromoCode! : referrer.referralCode;
      return { referrerCreatorId: referrer.id, referralCodeUsed: codeUsed };
    }
    this.logger.warn(`Registration referred by unknown code "${referralCodeInput}" — ignored, no attribution created.`);
    return null;
  }

  async attributeAtRegistration(
    tx: Prisma.TransactionClient,
    referredCreatorId: string,
    resolved: { referrerCreatorId: string; referralCodeUsed: string },
  ): Promise<void> {
    await tx.creatorReferral.create({
      data: {
        referrerCreatorId: resolved.referrerCreatorId,
        referredCreatorId,
        referralCodeUsed: resolved.referralCodeUsed,
        registeredAt: new Date(),
      },
    });
  }

  // ---- Milestone hooks (called from CreatorApplicationsService — the only real activity source
  // today; see the module-level comment) ----

  // Onboarding CreatorApplication reaches SUBMITTED for the first time (Phase 11) — the
  // `onboardingCompletedAt` timestamp was designed into the schema back in the 6B Enhancement
  // checkpoint and stayed NULL until this domain existed to emit the integration event (see
  // DECISIONS.md ADR-018). No milestone/reward type maps to onboarding submission or approval (see
  // ReferralMilestoneType in schema.prisma) — these are informational timestamps for
  // activity-classification only, not reward-triggering events, so unlike
  // onCampaignApplicationApproved below there is no rule-matching/reward-creation step here.
  async onOnboardingSubmitted(referredCreatorId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral || referral.onboardingCompletedAt) return;
    await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { onboardingCompletedAt: new Date() } });
  }

  // Onboarding CreatorApplication reaches APPROVED for the first time (Phase 11) — same dormant-
  // field-now-wired pattern as onOnboardingSubmitted above, for `creatorApprovedAt`.
  async onCreatorApproved(referredCreatorId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral || referral.creatorApprovedAt) return;
    await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { creatorApprovedAt: new Date() } });
  }

  // First-ever CampaignApplication submission by a referred creator.
  async onCampaignApplicationSubmitted(referredCreatorId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral || referral.firstCampaignApplicationAt) return;
    await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { firstCampaignApplicationAt: new Date() } });
  }

  // First CampaignApplication of a referred creator's to be APPROVED — the one real milestone
  // this checkpoint can evaluate rewards against (FIRST_APPROVED_CAMPAIGN_APPLICATION). Runs
  // best-effort/idempotently after the real approval transaction commits; the unique constraint
  // on (referralId, ruleId, sourceType, sourceId) makes a duplicate call for the same
  // applicationId a silent no-op rather than a double reward.
  async onCampaignApplicationApproved(referredCreatorId: string, applicationId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral) return; // this creator wasn't referred by anyone — nothing to do

    const now = new Date();
    if (!referral.firstApprovedCampaignApplicationAt) {
      await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { firstApprovedCampaignApplicationAt: now } });
    }

    const rules = await this.prisma.creatorReferralRule.findMany({
      where: {
        active: true,
        rewardType: "MILESTONE_FIXED",
        milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION",
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });

    for (const rule of rules) {
      // MILESTONE_FIXED is a one-time reward per (referral, rule) — the DB unique constraint is
      // keyed on sourceId too (for retry idempotency on a single event), so it alone would not
      // stop a referred creator's *second* approved application from paying out again while the
      // rule stays active. This check-then-create isn't race-proof against two concurrent
      // approvals for the same creator, but campaign-application approval is an infrequent,
      // admin-only action, so that window is accepted rather than adding DB-trigger complexity.
      const alreadyRewarded = await this.prisma.creatorReferralReward.findFirst({
        where: { referralId: referral.id, ruleId: rule.id },
      });
      if (alreadyRewarded) continue;

      try {
        await this.prisma.creatorReferralReward.create({
          data: {
            referralId: referral.id,
            ruleId: rule.id,
            sourceType: "CAMPAIGN_APPLICATION_APPROVED",
            sourceId: applicationId,
            calculatedRewardMinor: rule.fixedRewardMinor ?? 0,
            currency: rule.currency,
          },
        });
        if (!referral.qualifiedAt) {
          await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { qualifiedAt: now } });
        }
      } catch (err) {
        // P2002 = unique constraint violation — this exact (referral, rule, source) reward
        // already exists (a retried request, e.g.); every other error propagates.
        if (!(err instanceof Object && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
      }
    }
  }

  // First Content of a referred creator's to be APPROVED (Phase 7A) — mirrors
  // onCampaignApplicationApproved exactly for the FIRST_APPROVED_CONTENT milestone, which was
  // defined in the schema back in the 6B Enhancement checkpoint (firstApprovedContentAt) waiting
  // for exactly this integration event. See DECISIONS.md ADR-014.
  async onContentApproved(referredCreatorId: string, contentId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral) return; // this creator wasn't referred by anyone — nothing to do

    const now = new Date();
    if (!referral.firstApprovedContentAt) {
      await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { firstApprovedContentAt: now } });
    }

    const rules = await this.prisma.creatorReferralRule.findMany({
      where: {
        active: true,
        rewardType: "MILESTONE_FIXED",
        milestoneType: "FIRST_APPROVED_CONTENT",
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });

    for (const rule of rules) {
      // One-time per (referral, rule) — see onCampaignApplicationApproved's comment for why the
      // DB unique constraint alone (keyed on sourceId too) isn't sufficient on its own.
      const alreadyRewarded = await this.prisma.creatorReferralReward.findFirst({ where: { referralId: referral.id, ruleId: rule.id } });
      if (alreadyRewarded) continue;

      try {
        await this.prisma.creatorReferralReward.create({
          data: {
            referralId: referral.id,
            ruleId: rule.id,
            sourceType: "CONTENT_APPROVED",
            sourceId: contentId,
            calculatedRewardMinor: rule.fixedRewardMinor ?? 0,
            currency: rule.currency,
          },
        });
        if (!referral.qualifiedAt) {
          await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { qualifiedAt: now } });
        }
      } catch (err) {
        if (!(err instanceof Object && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
      }
    }
  }

  // First Order of a referred creator's to be a "qualified sale" (Phase 8) — mirrors
  // onCampaignApplicationApproved/onContentApproved exactly for the FIRST_QUALIFIED_SALE
  // milestone, defined back in the 6B Enhancement checkpoint (firstQualifiedSaleAt) waiting for
  // exactly this integration event. Called by PaymentsService once a Payment transitions to PAID
  // for an Order whose Attribution.creatorId is this referred creator — never on order creation,
  // since an unpaid order isn't a "sale".
  async onQualifiedSale(referredCreatorId: string, orderId: string): Promise<void> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { referredCreatorId } });
    if (!referral) return; // this creator wasn't referred by anyone — nothing to do

    const now = new Date();
    if (!referral.firstQualifiedSaleAt) {
      await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { firstQualifiedSaleAt: now } });
    }

    const rules = await this.prisma.creatorReferralRule.findMany({
      where: {
        active: true,
        rewardType: "MILESTONE_FIXED",
        milestoneType: "FIRST_QUALIFIED_SALE",
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });

    for (const rule of rules) {
      // One-time per (referral, rule) — see onCampaignApplicationApproved's comment for why the
      // DB unique constraint alone (keyed on sourceId too) isn't sufficient on its own.
      const alreadyRewarded = await this.prisma.creatorReferralReward.findFirst({ where: { referralId: referral.id, ruleId: rule.id } });
      if (alreadyRewarded) continue;

      try {
        await this.prisma.creatorReferralReward.create({
          data: {
            referralId: referral.id,
            ruleId: rule.id,
            sourceType: "QUALIFIED_SALE",
            sourceId: orderId,
            calculatedRewardMinor: rule.fixedRewardMinor ?? 0,
            currency: rule.currency,
          },
        });
        if (!referral.qualifiedAt) {
          await this.prisma.creatorReferral.update({ where: { id: referral.id }, data: { qualifiedAt: now } });
        }
      } catch (err) {
        if (!(err instanceof Object && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
      }
    }
  }

  // ---- Activity computation (live, not denormalized — see activity-classification.ts) ----

  private async computeActivity(
    referredCreatorId: string,
    registeredAt: Date,
  ): Promise<{
    activity: ActivityClass;
    lastMeaningfulActivityAt: Date;
    campaignApplicationCount: number;
    approvedCampaignApplicationCount: number;
  }> {
    const [onboarding, campaignApplications] = await Promise.all([
      this.prisma.creatorApplication.findFirst({ where: { creatorId: referredCreatorId }, orderBy: { createdAt: "desc" } }),
      this.prisma.campaignApplication.findMany({ where: { creatorId: referredCreatorId }, select: { status: true, createdAt: true, updatedAt: true } }),
    ]);

    const onboardingStatus = onboarding?.status ?? "DRAFT";
    const onboardingSubmittedAt = onboarding?.submittedAt ?? null;
    const onboardingUpdatedAt = onboarding?.updatedAt ?? registeredAt;
    const hasAnyCampaignApplication = campaignApplications.length > 0;
    const approvedCampaignApplicationCount = campaignApplications.filter((a) => a.status === "APPROVED").length;

    const activityTimestamps = [registeredAt, onboardingUpdatedAt, ...campaignApplications.map((a) => a.updatedAt)];
    const lastMeaningfulActivityAt = new Date(Math.max(...activityTimestamps.map((d) => d.getTime())));

    const activity = classifyActivity({
      now: new Date(),
      registeredAt,
      onboardingStatus,
      onboardingSubmittedAt,
      onboardingUpdatedAt,
      hasAnyCampaignApplication,
      hasApprovedCampaignApplication: approvedCampaignApplicationCount > 0,
      hasQualifiedEarnings: false, // no Order/Commission domain yet — always false today
      lastMeaningfulActivityAt,
    });

    return { activity, lastMeaningfulActivityAt, campaignApplicationCount: campaignApplications.length, approvedCampaignApplicationCount };
  }

  private rewardTotalsByStatus(rewards: { status: string; calculatedRewardMinor: number }[]): {
    pending: number;
    approved: number;
    paid: number;
  } {
    return {
      pending: rewards.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.calculatedRewardMinor, 0),
      approved: rewards.filter((r) => r.status === "APPROVED").reduce((s, r) => s + r.calculatedRewardMinor, 0),
      paid: rewards.filter((r) => r.status === "PAID").reduce((s, r) => s + r.calculatedRewardMinor, 0),
    };
  }

  // ---- Creator-facing ----

  async getMyReferralCode(creatorId: string, webAppUrl: string): Promise<{ referralCode: string; invitationLink: string }> {
    const profile = await this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { referralCode: true, customPromoCode: true } });
    const code = profile.customPromoCode || profile.referralCode;
    return { referralCode: code, invitationLink: `${webAppUrl}${INVITATION_BASE_PATH}?ref=${code}` };
  }

  async updateCustomPromoCode(creatorId: string, customPromoCode: string): Promise<{ success: boolean }> {
    // If empty string, clear the custom promo code
    if (!customPromoCode || customPromoCode.trim() === "") {
      await this.prisma.creatorProfile.update({
        where: { id: creatorId },
        data: { customPromoCode: null },
      });
      return { success: true };
    }

    // Check if the custom promo code is already taken by another creator — case-insensitively,
    // matching how resolveReferrerForAttribution looks it up at registration time. Without this,
    // two creators could hold visually-identical codes ("nuroy15" / "NUROY15") that would then
    // resolve to whichever one Prisma happens to return first, silently misattributing referrals.
    const existing = await this.prisma.creatorProfile.findFirst({
      where: {
        customPromoCode: { equals: customPromoCode.trim(), mode: "insensitive" },
        id: { not: creatorId },
      },
    });

    if (existing) {
      throw new Error("Bu promo kod allaqachon band qilingan");
    }

    // Update the custom promo code
    await this.prisma.creatorProfile.update({
      where: { id: creatorId },
      data: { customPromoCode: customPromoCode.trim() },
    });

    return { success: true };
  }

  async getMySummary(creatorId: string, webAppUrl: string): Promise<ReferralSummaryResponse> {
    const [profile, referrals] = await Promise.all([
      this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { referralCode: true } }),
      this.prisma.creatorReferral.findMany({ where: { referrerCreatorId: creatorId }, include: { rewards: true } }),
    ]);

    let activeCount = 0;
    let needsEncouragementCount = 0;
    let earningCount = 0;
    const allRewards = referrals.flatMap((r) => r.rewards);

    // Was a sequential for-await loop — computeActivity does 2 DB round-trips per referral, so a
    // creator with N referrals meant 2N queries run one after another instead of in parallel. This
    // page (the creator's own "Do'stlar" referral summary) is exactly the kind of thing a real
    // creator with an active referral network hits often, and the sequential version only gets
    // slower as their network grows.
    const activities = await Promise.all(
      referrals.map((referral) => this.computeActivity(referral.referredCreatorId, referral.registeredAt)),
    );
    for (const { activity } of activities) {
      if (activity === "EARNING") earningCount++;
      else if (activity === "ACTIVE_NO_EARNINGS") activeCount++;
      else if (activity === "ONBOARDING_STALLED" || activity === "APPROVED_INACTIVE" || activity === "DORMANT") needsEncouragementCount++;
    }

    const totals = this.rewardTotalsByStatus(allRewards);
    return {
      referralCode: profile.referralCode,
      invitationLink: `${webAppUrl}${INVITATION_BASE_PATH}?ref=${profile.referralCode}`,
      totalInvited: referrals.length,
      activeCount,
      needsEncouragementCount,
      earningCount,
      pendingRewardMinor: totals.pending,
      approvedRewardMinor: totals.approved,
      paidRewardMinor: totals.paid,
      currency: "UZS",
    };
  }

  private async toFriendResponse(referral: CreatorReferral & { rewards: { status: string; calculatedRewardMinor: number }[] }): Promise<ReferredFriendResponse> {
    const referred = await this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: referral.referredCreatorId }, select: { displayName: true } });
    const { activity, lastMeaningfulActivityAt, campaignApplicationCount, approvedCampaignApplicationCount } = await this.computeActivity(
      referral.referredCreatorId,
      referral.registeredAt,
    );
    const onboarding = await this.prisma.creatorApplication.findFirst({ where: { creatorId: referral.referredCreatorId }, orderBy: { createdAt: "desc" } });
    const totals = this.rewardTotalsByStatus(referral.rewards);

    return {
      id: referral.id,
      referredCreatorId: referral.referredCreatorId,
      displayName: referred.displayName,
      registeredAt: referral.registeredAt,
      onboardingStatus: onboarding?.status ?? "DRAFT",
      activity,
      lastMeaningfulActivityAt,
      campaignApplicationCount,
      approvedCampaignApplicationCount,
      // Content/Order/Commission domains don't exist yet — these are structurally always 0/null
      // today, never fabricated to look like real progress. See module comment.
      contentSubmittedCount: 0,
      approvedContentCount: 0,
      qualifiedSaleCount: 0,
      cumulativeQualifiedEarningsMinor: 0,
      qualifiedAt: referral.qualifiedAt,
      disqualifiedAt: referral.disqualifiedAt,
      pendingRewardMinor: totals.pending,
      approvedRewardMinor: totals.approved,
      paidRewardMinor: totals.paid,
    };
  }

  async listMine(creatorId: string): Promise<ReferredFriendResponse[]> {
    const referrals = await this.prisma.creatorReferral.findMany({
      where: { referrerCreatorId: creatorId },
      include: { rewards: true },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(referrals.map((r) => this.toFriendResponse(r)));
  }

  async findMineOrThrow(id: string, creatorId: string): Promise<ReferredFriendResponse> {
    const referral = await this.prisma.creatorReferral.findUnique({ where: { id }, include: { rewards: true } });
    // Same NOT_FOUND-for-both pattern as every other ownership-scoped read in this codebase —
    // a guessed id or another creator's referral must be indistinguishable from "doesn't exist".
    if (!referral || referral.referrerCreatorId !== creatorId) throw new DomainException("REFERRAL_NOT_FOUND", "Referral topilmadi.");
    return this.toFriendResponse(referral);
  }

  async listMyRewards(creatorId: string): Promise<ReferralRewardResponse[]> {
    const rewards = await this.prisma.creatorReferralReward.findMany({
      where: { referral: { referrerCreatorId: creatorId } },
      include: { rule: { select: { name: true } }, referral: { select: { referredCreatorId: true } } },
      orderBy: { createdAt: "desc" },
    });
    const referredIds = [...new Set(rewards.map((r) => r.referral.referredCreatorId))];
    const referredProfiles = await this.prisma.creatorProfile.findMany({ where: { id: { in: referredIds } }, select: { id: true, displayName: true } });
    const nameById = new Map(referredProfiles.map((p) => [p.id, p.displayName]));

    return rewards.map((r) => ({
      id: r.id,
      referralId: r.referralId,
      referredDisplayName: nameById.get(r.referral.referredCreatorId) ?? "Creator",
      ruleName: r.rule.name,
      status: r.status,
      qualifiedEarningsMinor: r.qualifiedEarningsMinor,
      calculatedRewardMinor: r.calculatedRewardMinor,
      currency: r.currency,
      approvedAt: r.approvedAt,
      rejectedAt: r.rejectedAt,
      rejectionReason: r.rejectionReason,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    }));
  }

  // ---- Admin: rule management ----

  private assertRuleIsValid(dto: { rewardType: string; milestoneType?: string | null; fixedRewardMinor?: number | null; rewardRateBps?: number | null }): void {
    if (dto.rewardType === "MILESTONE_FIXED") {
      if (!dto.milestoneType) throw new DomainException("REFERRAL_RULE_INVALID", "MILESTONE_FIXED uchun milestoneType kiritilishi shart.");
      if (dto.fixedRewardMinor == null || dto.fixedRewardMinor <= 0) {
        throw new DomainException("REFERRAL_RULE_INVALID", "MILESTONE_FIXED uchun fixedRewardMinor musbat bo'lishi kerak.");
      }
      if (dto.rewardRateBps != null) throw new DomainException("REFERRAL_RULE_INVALID", "MILESTONE_FIXED rejimida rewardRateBps bo'sh bo'lishi kerak.");
    } else if (dto.rewardType === "EARNINGS_PERCENTAGE") {
      if (dto.rewardRateBps == null || dto.rewardRateBps <= 0) {
        throw new DomainException("REFERRAL_RULE_INVALID", "EARNINGS_PERCENTAGE uchun rewardRateBps musbat bo'lishi kerak.");
      }
      if (dto.fixedRewardMinor != null) throw new DomainException("REFERRAL_RULE_INVALID", "EARNINGS_PERCENTAGE rejimida fixedRewardMinor bo'sh bo'lishi kerak.");
    }
  }

  async listRules(): Promise<ReferralRuleResponse[]> {
    return this.prisma.creatorReferralRule.findMany({ orderBy: { createdAt: "desc" } });
  }

  async createRule(dto: CreateReferralRuleDto): Promise<ReferralRuleResponse> {
    this.assertRuleIsValid(dto);
    return this.prisma.creatorReferralRule.create({
      data: {
        name: dto.name,
        rewardType: dto.rewardType,
        milestoneType: dto.rewardType === "MILESTONE_FIXED" ? dto.milestoneType : undefined,
        fixedRewardMinor: dto.rewardType === "MILESTONE_FIXED" ? dto.fixedRewardMinor : undefined,
        rewardRateBps: dto.rewardType === "EARNINGS_PERCENTAGE" ? dto.rewardRateBps : undefined,
        currency: dto.currency ?? "UZS",
        qualifyingEarningsThresholdMinor: dto.qualifyingEarningsThresholdMinor,
        earningWindowDays: dto.earningWindowDays,
        maximumRewardPerReferralMinor: dto.maximumRewardPerReferralMinor,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        active: dto.active ?? true,
      },
    });
  }

  async updateRule(id: string, dto: UpdateReferralRuleDto): Promise<ReferralRuleResponse> {
    const existing = await this.prisma.creatorReferralRule.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Referral qoidasi topilmadi.");
    const nextRewardType = dto.rewardType ?? existing.rewardType;
    this.assertRuleIsValid({
      rewardType: nextRewardType,
      milestoneType: dto.milestoneType ?? existing.milestoneType,
      fixedRewardMinor: dto.fixedRewardMinor !== undefined ? dto.fixedRewardMinor : existing.fixedRewardMinor,
      rewardRateBps: dto.rewardRateBps !== undefined ? dto.rewardRateBps : existing.rewardRateBps,
    });
    return this.prisma.creatorReferralRule.update({
      where: { id },
      data: {
        name: dto.name,
        rewardType: dto.rewardType,
        milestoneType: dto.milestoneType,
        fixedRewardMinor: dto.fixedRewardMinor,
        rewardRateBps: dto.rewardRateBps,
        currency: dto.currency,
        qualifyingEarningsThresholdMinor: dto.qualifyingEarningsThresholdMinor,
        earningWindowDays: dto.earningWindowDays,
        maximumRewardPerReferralMinor: dto.maximumRewardPerReferralMinor,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        active: dto.active,
      },
    });
  }

  async setRuleActive(id: string, active: boolean): Promise<ReferralRuleResponse> {
    const existing = await this.prisma.creatorReferralRule.findUnique({ where: { id } });
    if (!existing) throw new DomainException("NOT_FOUND", "Referral qoidasi topilmadi.");
    return this.prisma.creatorReferralRule.update({ where: { id }, data: { active } });
  }

  // ---- Admin: referral list/detail/disqualify, reward approve/reject ----

  async listForAdmin(query: AdminReferralQueryDto): Promise<PaginatedResult<AdminReferralResponse>> {
    const where: Prisma.CreatorReferralWhereInput = {
      referrerCreatorId: query.referrerCreatorId,
      referredCreatorId: query.referredCreatorId,
      ...(query.search
        ? {
            OR: [
              { referrer: { displayName: { contains: query.search, mode: "insensitive" } } },
              { referred: { displayName: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "registeredAt", "qualifiedAt"]);
    const orderBy: Prisma.CreatorReferralOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.creatorReferral.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
        include: { referrer: { select: { id: true, displayName: true } }, referred: { select: { id: true, displayName: true } }, rewards: { include: { rule: true } } },
      }),
      this.prisma.creatorReferral.count({ where }),
    ]);

    const mapped = await Promise.all(items.map((r) => this.toAdminResponse(r)));
    const filtered = query.activity ? mapped.filter((r) => r.activity === query.activity) : mapped;
    return paginate(filtered, query.activity ? filtered.length : total, query);
  }

  private async toAdminResponse(
    referral: CreatorReferral & {
      referrer: { id: string; displayName: string };
      referred: { id: string; displayName: string };
      rewards: { id: string; referralId: string; ruleId: string; rule: { name: string }; status: string; qualifiedEarningsMinor: number | null; calculatedRewardMinor: number; currency: string; approvedAt: Date | null; rejectedAt: Date | null; rejectionReason: string | null; paidAt: Date | null; createdAt: Date }[];
    },
  ): Promise<AdminReferralResponse> {
    const { activity, lastMeaningfulActivityAt, campaignApplicationCount, approvedCampaignApplicationCount } = await this.computeActivity(
      referral.referredCreatorId,
      referral.registeredAt,
    );
    return {
      id: referral.id,
      referrer: referral.referrer,
      referred: referral.referred,
      referralCodeUsed: referral.referralCodeUsed,
      attributedAt: referral.attributedAt,
      registeredAt: referral.registeredAt,
      activity,
      lastMeaningfulActivityAt,
      qualifiedAt: referral.qualifiedAt,
      disqualifiedAt: referral.disqualifiedAt,
      disqualificationReason: referral.disqualificationReason,
      campaignApplicationCount,
      approvedCampaignApplicationCount,
      rewards: referral.rewards.map((r) => ({
        id: r.id,
        referralId: r.referralId,
        referredDisplayName: referral.referred.displayName,
        ruleName: r.rule.name,
        status: r.status,
        qualifiedEarningsMinor: r.qualifiedEarningsMinor,
        calculatedRewardMinor: r.calculatedRewardMinor,
        currency: r.currency,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt,
        rejectionReason: r.rejectionReason,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
      })),
    };
  }

  async findOneForAdminOrThrow(id: string): Promise<AdminReferralResponse> {
    const referral = await this.prisma.creatorReferral.findUnique({
      where: { id },
      include: { referrer: { select: { id: true, displayName: true } }, referred: { select: { id: true, displayName: true } }, rewards: { include: { rule: true } } },
    });
    if (!referral) throw new DomainException("REFERRAL_NOT_FOUND", "Referral topilmadi.");
    return this.toAdminResponse(referral);
  }

  async disqualify(id: string, reason: string): Promise<AdminReferralResponse> {
    const existing = await this.prisma.creatorReferral.findUnique({ where: { id } });
    if (!existing) throw new DomainException("REFERRAL_NOT_FOUND", "Referral topilmadi.");
    await this.prisma.creatorReferral.update({ where: { id }, data: { disqualifiedAt: new Date(), disqualificationReason: reason } });
    return this.findOneForAdminOrThrow(id);
  }

  async approveReward(id: string): Promise<ReferralRewardResponse> {
    const reward = await this.prisma.creatorReferralReward.findUnique({ where: { id } });
    if (!reward) throw new DomainException("NOT_FOUND", "Referral mukofoti topilmadi.");
    if (reward.status !== "PENDING") {
      throw new DomainException("CONFLICT", "Faqat kutilayotgan mukofotni tasdiqlash mumkin.", { status: reward.status });
    }
    await this.prisma.creatorReferralReward.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    return this.rewardById(id);
  }

  async rejectReward(id: string, reason: string): Promise<ReferralRewardResponse> {
    const reward = await this.prisma.creatorReferralReward.findUnique({ where: { id } });
    if (!reward) throw new DomainException("NOT_FOUND", "Referral mukofoti topilmadi.");
    if (reward.status !== "PENDING") {
      throw new DomainException("CONFLICT", "Faqat kutilayotgan mukofotni rad etish mumkin.", { status: reward.status });
    }
    await this.prisma.creatorReferralReward.update({ where: { id }, data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: reason } });
    return this.rewardById(id);
  }

  private async rewardById(id: string): Promise<ReferralRewardResponse> {
    const r = await this.prisma.creatorReferralReward.findUniqueOrThrow({
      where: { id },
      include: { rule: { select: { name: true } }, referral: { select: { referredCreatorId: true } } },
    });
    const referred = await this.prisma.creatorProfile.findUnique({ where: { id: r.referral.referredCreatorId }, select: { displayName: true } });
    return {
      id: r.id,
      referralId: r.referralId,
      referredDisplayName: referred?.displayName ?? "Creator",
      ruleName: r.rule.name,
      status: r.status,
      qualifiedEarningsMinor: r.qualifiedEarningsMinor,
      calculatedRewardMinor: r.calculatedRewardMinor,
      currency: r.currency,
      approvedAt: r.approvedAt,
      rejectedAt: r.rejectedAt,
      rejectionReason: r.rejectionReason,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    };
  }

  // Reserved for when the Order/Commission domain exists — computes what an EARNINGS_PERCENTAGE
  // rule would award for a given qualified-earnings amount. Deterministic integer rounding via
  // applyBasisPoints (see common/money/money.ts), never floating point. Not called from anywhere
  // yet; kept here (rather than deleted) so the reward math is already correct and reviewed
  // before the real earning-event hook is wired up.
  calculateEarningsPercentageReward(qualifiedEarningsMinor: number, rewardRateBps: number, capMinor: number | null): number {
    const raw = applyBasisPoints(qualifiedEarningsMinor, rewardRateBps);
    return capMinor != null ? Math.min(raw, capMinor) : raw;
  }
}
