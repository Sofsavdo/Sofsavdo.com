import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AdminCreatorsService } from "./admin-creators.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";

describe("AdminCreatorsService (Phase 12)", () => {
  let service: AdminCreatorsService;
  let prisma: {
    creatorProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
    creatorCampaign: { findMany: jest.Mock };
    commission: { groupBy: jest.Mock };
    payout: { groupBy: jest.Mock };
    user: { update: jest.Mock };
  };
  let referrals: { getMySummary: jest.Mock };
  let audit: { record: jest.Mock };

  const creatorRow = (over: Record<string, unknown> = {}) => ({
    id: "creator1",
    displayName: "Test Creator",
    city: "Toshkent",
    createdAt: new Date(),
    user: { id: "user1", email: "creator@rosti.uz", phone: null, status: "ACTIVE" },
    applications: [{ status: "APPROVED", currentStep: 8, submittedAt: new Date(), reviewedAt: new Date() }],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      creatorProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      creatorCampaign: { findMany: jest.fn() },
      commission: { groupBy: jest.fn() },
      payout: { groupBy: jest.fn() },
      user: { update: jest.fn() },
    };
    referrals = { getMySummary: jest.fn() };
    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCreatorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReferralsService, useValue: referrals },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue("http://localhost:3100") } },
      ],
    }).compile();
    service = moduleRef.get(AdminCreatorsService);
  });

  describe("findOneOrThrow", () => {
    it("throws NOT_FOUND for a missing creator", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(null);
      await expect(service.findOneOrThrow("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("maps verified from an APPROVED onboarding application", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      const result = await service.findOneOrThrow("creator1");
      expect(result.verified).toBe(true);
      expect(result.accountStatus).toBe("ACTIVE");
    });

    it("verified is false when onboarding is not APPROVED", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ applications: [{ status: "SUBMITTED", currentStep: 3, submittedAt: null, reviewedAt: null }] }));
      const result = await service.findOneOrThrow("creator1");
      expect(result.verified).toBe(false);
    });
  });

  describe("earnings/payout summary", () => {
    it("maps Commission groupBy sums onto the fixed EarningsSummary shape", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      prisma.commission.groupBy.mockResolvedValue([
        { status: "PENDING", _sum: { amountMinor: 1000 } },
        { status: "PAID", _sum: { amountMinor: 5000 } },
      ]);
      const result = await service.getEarningsSummary("creator1");
      expect(result.pendingMinor).toBe(1000);
      expect(result.paidMinor).toBe(5000);
      expect(result.approvedMinor).toBe(0);
    });

    it("maps Payout groupBy sums onto the fixed PayoutSummary shape", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      prisma.payout.groupBy.mockResolvedValue([{ status: "PAID", _sum: { amountMinor: 20000 } }]);
      const result = await service.getPayoutSummary("creator1");
      expect(result.paidMinor).toBe(20000);
      expect(result.requestedMinor).toBe(0);
    });
  });

  describe("referral summary", () => {
    it("delegates to ReferralsService.getMySummary with the creatorId", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      referrals.getMySummary.mockResolvedValue({ referralCode: "abc", totalInvited: 3 });
      const result = await service.getReferralSummary("creator1");
      expect(referrals.getMySummary).toHaveBeenCalledWith("creator1", "http://localhost:3100");
      expect(result.totalInvited).toBe(3);
    });
  });

  describe("account status transitions", () => {
    it("suspend requires ACTIVE and transitions to SUSPENDED with a reason", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      await service.suspend("creator1", "actor1", "Fraud signals");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "SUSPENDED" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATOR_SUSPENDED" }));
    });

    it("suspend rejects a creator already SUSPENDED", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ user: { id: "user1", email: "x", phone: null, status: "SUSPENDED" } }));
      await expect(service.suspend("creator1", "actor1", "reason")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("unsuspend requires SUSPENDED and transitions to ACTIVE", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ user: { id: "user1", email: "x", phone: null, status: "SUSPENDED" } }));
      await service.unsuspend("creator1", "actor1");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "ACTIVE" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATOR_UNSUSPENDED" }));
    });

    it("block works from either ACTIVE or SUSPENDED", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ user: { id: "user1", email: "x", phone: null, status: "SUSPENDED" } }));
      await service.block("creator1", "actor1", "Severe policy violation");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "BLOCKED" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATOR_BLOCKED" }));
    });

    it("unblock requires BLOCKED and transitions to ACTIVE", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ user: { id: "user1", email: "x", phone: null, status: "BLOCKED" } }));
      await service.unblock("creator1", "actor1");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "ACTIVE" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATOR_UNBLOCKED" }));
    });

    it("unblock rejects a creator that isn't BLOCKED", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow());
      await expect(service.unblock("creator1", "actor1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });
});
