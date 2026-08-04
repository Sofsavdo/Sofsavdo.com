import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AppLogger } from "../common/logging/app-logger.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PAID_ORDER_STATUSES } from "../analytics/lib/analytics-filters.util";

export interface CreatorStats {
  commissionEarned: number;
  referralsCount: number;
  successfulOrders: number;
}

export interface LaunchBonusProgress {
  id: string;
  bonusAmountMinor: number;
  status: string;
  deadline: Date;
  commissionEarnedMinor: number;
  referralsCount: number;
  ordersCount: number;
  bioLinkVerified: boolean;
  minCommissionMinor: number | null;
  minReferrals: number | null;
  minOrders: number | null;
  bioLinkRequired: boolean;
}

@Injectable()
export class LaunchBonusService {
  constructor(
    private prisma: PrismaService,
    private logger: AppLogger,
    private events: EventEmitter2,
  ) {
    this.logger.setContext(LaunchBonusService.name);
  }

  async createBonusForCreator(creatorProfileId: string): Promise<void> {
    const settings = await this.prisma.launchBonusSettings.findFirst({
      where: { isActive: true },
    });

    if (!settings) {
      this.logger.log(`No active launch bonus settings found, skipping bonus creation for creator ${creatorProfileId}`);
      return;
    }

    // Check if creator was referred
    const referral = await this.prisma.creatorReferral.findUnique({
      where: { referredCreatorId: creatorProfileId },
    });

    const isReferred = !!referral;
    const bonusAmountMinor = isReferred ? settings.referralBonusAmountMinor : settings.bonusAmountMinor;

    const deadline = new Date(Date.now() + settings.deadlineDays * 24 * 60 * 60 * 1000);

    await this.prisma.launchBonus.create({
      data: {
        creatorProfileId,
        settingsId: settings.id,
        bonusAmountMinor,
        deadline,
      },
    });

    this.logger.log(`Launch bonus created for creator ${creatorProfileId} (${isReferred ? 'referred' : 'normal'}), amount: ${bonusAmountMinor}, deadline: ${deadline}`);
  }

  async createBonusForCreatorInTransaction(tx: Prisma.TransactionClient, creatorProfileId: string): Promise<void> {
    const settings = await tx.launchBonusSettings.findFirst({
      where: { isActive: true },
    });

    if (!settings) {
      this.logger.log(`No active launch bonus settings found, skipping bonus creation for creator ${creatorProfileId}`);
      return;
    }

    // Check if creator was referred
    const referral = await tx.creatorReferral.findUnique({
      where: { referredCreatorId: creatorProfileId },
    });

    const isReferred = !!referral;
    const bonusAmountMinor = isReferred ? settings.referralBonusAmountMinor : settings.bonusAmountMinor;

    const deadline = new Date(Date.now() + settings.deadlineDays * 24 * 60 * 60 * 1000);

    await tx.launchBonus.create({
      data: {
        creatorProfileId,
        settingsId: settings.id,
        bonusAmountMinor,
        deadline,
      },
    });

    this.logger.log(`Launch bonus created for creator ${creatorProfileId} (${isReferred ? 'referred' : 'normal'}), amount: ${bonusAmountMinor}, deadline: ${deadline}`);
  }

  async getCreatorStats(creatorProfileId: string): Promise<CreatorStats> {
    // What the creator has actually EARNED from real sales — every non-reversed Commission,
    // regardless of whether it's been paid out yet (PENDING/APPROVED/PAYABLE/PAID/DONATED all
    // count; REJECTED/REFUNDED don't). Was previously summing Payout.amountMinor where
    // status="PAID", which only counts money the creator has already successfully withdrawn —
    // a much later, stricter condition than "earned," and one a creator working toward this exact
    // bonus would rarely have hit yet (payouts are a separate, creator-initiated, admin-approved
    // request). See CommissionsService.getWalletBalance for the same non-reversed-statuses
    // convention used everywhere else "earned" is computed.
    const commission = await this.prisma.commission.aggregate({
      where: {
        creatorId: creatorProfileId,
        status: { notIn: ["REJECTED", "REFUNDED"] },
      },
      _sum: { amountMinor: true },
    });

    // Total friends this creator has referred — was previously filtered to only referred
    // creators whose OWN account was created within a rolling 30-days-from-now window, which has
    // no relationship to this creator's own bonus deadline and would silently stop counting a
    // referral the moment it turned 30 days old, no matter how active or long-standing.
    const referrals = await this.prisma.creatorReferral.count({
      where: { referrerCreatorId: creatorProfileId },
    });

    // Real, paid-for orders attributed to this creator — matches PAID_ORDER_STATUSES (paid
    // through delivered, plus refunded since it was still a real sale) used everywhere else in
    // the codebase for "this order counts as a real sale," rather than the single "PAID" status,
    // which excludes an order the moment it progresses to PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED.
    const orders = await this.prisma.order.count({
      where: {
        attribution: { creatorId: creatorProfileId },
        status: { in: [...PAID_ORDER_STATUSES] },
      },
    });

    return {
      commissionEarned: commission._sum?.amountMinor || 0,
      referralsCount: referrals,
      successfulOrders: orders,
    };
  }

  async getCreatorBonusProgress(creatorProfileId: string): Promise<LaunchBonusProgress | null> {
    const bonus = await this.prisma.launchBonus.findUnique({
      where: { creatorProfileId },
      include: { settings: true },
    });

    if (!bonus) return null;

    return {
      id: bonus.id,
      bonusAmountMinor: bonus.bonusAmountMinor,
      status: bonus.status,
      deadline: bonus.deadline,
      commissionEarnedMinor: bonus.commissionEarnedMinor,
      referralsCount: bonus.referralsCount,
      ordersCount: bonus.ordersCount,
      bioLinkVerified: bonus.bioLinkVerified,
      minCommissionMinor: bonus.settings.minCommissionMinor,
      minReferrals: bonus.settings.minReferrals,
      minOrders: bonus.settings.minOrders,
      bioLinkRequired: bonus.settings.bioLinkRequired,
    };
  }

  async checkAndUpdateBonuses(): Promise<void> {
    const bonuses = await this.prisma.launchBonus.findMany({
      where: { status: "LOCKED" },
      include: { settings: true, creatorProfile: true },
    });

    this.logger.log(`Checking ${bonuses.length} locked bonuses`);

    for (const bonus of bonuses) {
      try {
        const stats = await this.getCreatorStats(bonus.creatorProfileId);

        // Update progress
        await this.prisma.launchBonus.update({
          where: { id: bonus.id },
          data: {
            commissionEarnedMinor: stats.commissionEarned,
            referralsCount: stats.referralsCount,
            ordersCount: stats.successfulOrders,
          },
        });

        // Check if all requirements met
        const allMet = this.checkRequirementsMet(stats, bonus.settings, bonus);

        if (allMet) {
          await this.prisma.launchBonus.update({
            where: { id: bonus.id },
            data: { status: "UNLOCKED", unlockedAt: new Date() },
          });
          this.logger.log(`Bonus unlocked for creator ${bonus.creatorProfileId}`);
          await this.events.emitAsync(NOTIFICATION_EVENTS.BONUS_UNLOCKED, {
            creatorProfileId: bonus.creatorProfileId,
            bonusAmountMinor: bonus.bonusAmountMinor,
          });
        } else if (new Date() > bonus.deadline) {
          await this.prisma.launchBonus.update({
            where: { id: bonus.id },
            data: { status: "EXPIRED" },
          });
          this.logger.log(`Bonus expired for creator ${bonus.creatorProfileId}`);
          await this.events.emitAsync(NOTIFICATION_EVENTS.BONUS_EXPIRED, {
            creatorProfileId: bonus.creatorProfileId,
          });
        }
      } catch (error) {
        this.logger.error(`Error checking bonus ${bonus.id}: ${error}`);
      }
    }
  }

  private checkRequirementsMet(
    stats: CreatorStats,
    settings: any,
    bonus: any,
  ): boolean {
    if (settings.minCommissionMinor && stats.commissionEarned < settings.minCommissionMinor) {
      return false;
    }
    if (settings.minReferrals && stats.referralsCount < settings.minReferrals) {
      return false;
    }
    if (settings.minOrders && stats.successfulOrders < settings.minOrders) {
      return false;
    }
    if (settings.bioLinkRequired && !bonus.bioLinkVerified) {
      return false;
    }
    return true;
  }

  async getSettings(): Promise<any> {
    const settings = await this.prisma.launchBonusSettings.findFirst({
      where: { isActive: true },
    });
    return settings;
  }

  async updateSettings(data: {
    bonusAmountMinor?: number;
    referralBonusAmountMinor?: number;
    deadlineDays?: number;
    minCommissionMinor?: number;
    minReferrals?: number;
    minOrders?: number;
    bioLinkRequired?: boolean;
    isActive?: boolean;
  }): Promise<any> {
    const existing = await this.prisma.launchBonusSettings.findFirst();

    if (existing) {
      return this.prisma.launchBonusSettings.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.launchBonusSettings.create({
      data: {
        ...data,
        bonusAmountMinor: data.bonusAmountMinor ?? 150_000_000,
        referralBonusAmountMinor: data.referralBonusAmountMinor ?? 250_000_000,
        deadlineDays: data.deadlineDays ?? 30,
      },
    });
  }

  async verifyBioLink(creatorProfileId: string, verifiedBy: string, approved: boolean): Promise<void> {
    await this.prisma.launchBonus.update({
      where: { creatorProfileId },
      data: {
        bioLinkVerified: approved,
        bioLinkVerifiedAt: approved ? new Date() : null,
        bioLinkVerifiedBy: approved ? verifiedBy : null,
      },
    });

    // Also update CreatorProfile bioComplianceStatus
    await this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: {
        bioComplianceStatus: approved ? "COMPLIANT" : "NON_COMPLIANT",
      },
    });
  }

  async getPendingBioVerifications(): Promise<any[]> {
    const bonuses = await this.prisma.launchBonus.findMany({
      where: {
        status: "LOCKED",
        bioLinkVerified: false,
        settings: { bioLinkRequired: true },
      },
      include: {
        creatorProfile: {
          include: {
            user: true,
            socialAccounts: true,
          },
        },
      },
    });

    return bonuses;
  }
}
