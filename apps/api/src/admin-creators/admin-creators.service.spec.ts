import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AdminCreatorsService } from "./admin-creators.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";

describe("AdminCreatorsService (Phase 12)", () => {
  let service: AdminCreatorsService;
  let prisma: {
    creatorProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    creatorCampaign: { findMany: jest.Mock };
    commission: { groupBy: jest.Mock };
    payout: { groupBy: jest.Mock };
    flow: { groupBy: jest.Mock };
    user: { update: jest.Mock };
  };
  let referrals: { getMySummary: jest.Mock };
  let audit: { record: jest.Mock };

  const creatorRow = (over: Record<string, unknown> = {}) => ({
    id: "creator1",
    displayName: "Test Creator",
    city: "Toshkent",
    createdAt: new Date(),
    bioComplianceStatus: "PENDING",
    tier: "STANDARD",
    user: { id: "user1", email: "creator@sofsavdo.com", phone: null, status: "ACTIVE" },
    applications: [{ status: "APPROVED", currentStep: 8, submittedAt: new Date(), reviewedAt: new Date() }],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      creatorProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      creatorCampaign: { findMany: jest.fn() },
      commission: { groupBy: jest.fn() },
      payout: { groupBy: jest.fn() },
      flow: { groupBy: jest.fn().mockResolvedValue([]) },
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

  describe("list — activity classification", () => {
    it("merges per-creator flow aggregates and classifies EARNING when a flow has orders", async () => {
      prisma.creatorProfile.findMany.mockResolvedValue([creatorRow()]);
      prisma.creatorProfile.count.mockResolvedValue(1);
      prisma.flow.groupBy.mockResolvedValue([
        { creatorProfileId: "creator1", _count: { _all: 2 }, _sum: { clickCount: 40, orderCount: 3, commissionEarnedMinor: 90000 }, _max: { updatedAt: new Date() } },
      ]);
      const result = await service.list({ skip: 0, take: 20, page: 1, pageSize: 20 } as never);
      expect(result.items[0]!.activityStatus).toBe("EARNING");
      expect(result.items[0]!.flowCount).toBe(2);
      expect(result.items[0]!.totalClicks).toBe(40);
      expect(result.items[0]!.totalEarnedMinor).toBe(90000);
    });

    it("classifies a creator with no flow rows (absent from the aggregate map) past the grace window as NO_FLOW", async () => {
      const old = new Date(Date.now() - 30 * 86_400_000);
      prisma.creatorProfile.findMany.mockResolvedValue([creatorRow({ createdAt: old })]);
      prisma.creatorProfile.count.mockResolvedValue(1);
      prisma.flow.groupBy.mockResolvedValue([]);
      const result = await service.list({ skip: 0, take: 20, page: 1, pageSize: 20 } as never);
      expect(result.items[0]!.activityStatus).toBe("NO_FLOW");
      expect(result.items[0]!.flowCount).toBe(0);
      expect(result.items[0]!.lastActivityAt).toEqual(old);
    });

    it("translates an activityStatus filter into a relation where-clause on the creator query", async () => {
      prisma.creatorProfile.findMany.mockResolvedValue([]);
      prisma.creatorProfile.count.mockResolvedValue(0);
      await service.list({ skip: 0, take: 20, page: 1, pageSize: 20, activityStatus: "NO_FLOW" } as never);
      const where = prisma.creatorProfile.findMany.mock.calls[0]![0].where;
      expect(JSON.stringify(where)).toContain('"none"');
    });
  });

  describe("getActivitySummary", () => {
    it("returns funnel counts, with tookFlow summing the three post-flow buckets", async () => {
      // count() is called 6× in order: total, NEW, NO_FLOW, FLOW_NO_CLICKS, ACTIVE_NO_EARNINGS, EARNING
      prisma.creatorProfile.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(25);
      const result = await service.getActivitySummary();
      expect(result).toEqual({ total: 100, newCount: 10, noFlow: 30, flowNoClicks: 20, activeNoEarnings: 15, earning: 25, tookFlow: 60 });
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

  describe("bio compliance + tier (Phase Q)", () => {
    it("setBioCompliance updates the status and records an audit entry with before/after", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ bioComplianceStatus: "PENDING" }));
      await service.setBioCompliance("creator1", "NON_COMPLIANT", "actor1");
      expect(prisma.creatorProfile.update).toHaveBeenCalledWith({ where: { id: "creator1" }, data: { bioComplianceStatus: "NON_COMPLIANT" } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor1",
          action: "CREATOR_BIO_COMPLIANCE_SET",
          before: { bioComplianceStatus: "PENDING" },
          after: { bioComplianceStatus: "NON_COMPLIANT" },
        }),
      );
    });

    it("setBioCompliance has no ALLOWED_FROM guard — any status can move to any other", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ bioComplianceStatus: "NON_COMPLIANT" }));
      await expect(service.setBioCompliance("creator1", "COMPLIANT", "actor1")).resolves.toBeDefined();
    });

    it("setTier updates the tier and records an audit entry with before/after", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(creatorRow({ tier: "STANDARD" }));
      await service.setTier("creator1", "PREMIUM", "actor1");
      expect(prisma.creatorProfile.update).toHaveBeenCalledWith({ where: { id: "creator1" }, data: { tier: "PREMIUM" } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: "actor1", action: "CREATOR_TIER_SET", before: { tier: "STANDARD" }, after: { tier: "PREMIUM" } }),
      );
    });
  });
});
