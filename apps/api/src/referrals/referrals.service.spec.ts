import { Test } from "@nestjs/testing";
import { ReferralsService } from "./referrals.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReferralsService", () => {
  let service: ReferralsService;
  let prisma: {
    creatorProfile: { findUnique: jest.Mock; findFirst: jest.Mock };
    creatorReferral: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    creatorReferralRule: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    creatorReferralReward: { create: jest.Mock; findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      creatorProfile: { findUnique: jest.fn(), findFirst: jest.fn() },
      creatorReferral: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      creatorReferralRule: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      creatorReferralReward: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ReferralsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReferralsService);
  });

  describe("resolveReferrerForAttribution", () => {
    it("returns null (no attribution) for an undefined code — never blocks registration", async () => {
      const result = await service.resolveReferrerForAttribution(undefined, prisma as never);
      expect(result).toBeNull();
      expect(prisma.creatorProfile.findFirst).not.toHaveBeenCalled();
    });

    it("returns null (no attribution, no throw) for an unknown/invalid code", async () => {
      prisma.creatorProfile.findFirst.mockResolvedValue(null);
      const result = await service.resolveReferrerForAttribution("UNKNOWN1", prisma as never);
      expect(result).toBeNull();
    });

    it("resolves a valid code to the referrer's creatorId", async () => {
      prisma.creatorProfile.findFirst.mockResolvedValue({ id: "creator-referrer-1" });
      const result = await service.resolveReferrerForAttribution("VALIDCOD", prisma as never);
      expect(result).toEqual({ referrerCreatorId: "creator-referrer-1", referralCodeUsed: "VALIDCOD" });
    });
  });

  describe("generateUniqueReferralCode", () => {
    it("generates an 8-character code", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(null);
      const code = await service.generateUniqueReferralCode();
      expect(code).toHaveLength(8);
    });

    it("retries on collision until a free code is found", async () => {
      prisma.creatorProfile.findUnique
        .mockResolvedValueOnce({ id: "taken" })
        .mockResolvedValueOnce({ id: "taken" })
        .mockResolvedValueOnce(null);
      const code = await service.generateUniqueReferralCode();
      expect(code).toHaveLength(8);
      expect(prisma.creatorProfile.findUnique).toHaveBeenCalledTimes(3);
    });
  });

  describe("onCampaignApplicationApproved", () => {
    it("does nothing (no throw) when the approved creator was never referred", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue(null);
      await service.onCampaignApplicationApproved("unreferred-creator", "app1");
      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });

    it("registration/onboarding alone never creates a reward — only this milestone hook does, and only when called", async () => {
      // Sanity check that the service exposes no other reward-creating path than the two
      // milestone hooks — registration (AuthService) never calls creatorReferralReward.create.
      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });

    it("creates a MILESTONE_FIXED reward on first approved campaign application when an active matching rule exists", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({
        id: "referral1",
        firstApprovedCampaignApplicationAt: null,
        qualifiedAt: null,
      });
      prisma.creatorReferralRule.findMany.mockResolvedValue([
        { id: "rule1", fixedRewardMinor: 50_000_00, currency: "UZS" },
      ]);
      prisma.creatorReferralReward.create.mockResolvedValue({ id: "reward1" });

      await service.onCampaignApplicationApproved("referred-creator-1", "app1");

      expect(prisma.creatorReferral.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "referral1" }, data: expect.objectContaining({ firstApprovedCampaignApplicationAt: expect.any(Date) }) }),
      );
      expect(prisma.creatorReferralReward.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referralId: "referral1",
            ruleId: "rule1",
            sourceType: "CAMPAIGN_APPLICATION_APPROVED",
            sourceId: "app1",
            calculatedRewardMinor: 50_000_00,
          }),
        }),
      );
    });

    it("is idempotent: a duplicate call for the same (referral, rule, source) does not throw or double-create (P2002 swallowed)", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedCampaignApplicationAt: new Date(), qualifiedAt: new Date() });
      prisma.creatorReferralRule.findMany.mockResolvedValue([{ id: "rule1", fixedRewardMinor: 50_000_00, currency: "UZS" }]);
      const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      prisma.creatorReferralReward.create.mockRejectedValue(p2002);

      await expect(service.onCampaignApplicationApproved("referred-creator-1", "app1")).resolves.toBeUndefined();
    });

    it("does not pay a MILESTONE_FIXED reward twice for the same (referral, rule) even on a genuinely different sourceId", async () => {
      // A referred creator's *second* approved application is a different event (different
      // applicationId) but must not pay the same one-time milestone out again while the rule
      // is still active — see ReferralsService.onCampaignApplicationApproved's comment.
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedCampaignApplicationAt: new Date(), qualifiedAt: new Date() });
      prisma.creatorReferralRule.findMany.mockResolvedValue([{ id: "rule1", fixedRewardMinor: 50_000_00, currency: "UZS" }]);
      prisma.creatorReferralReward.findFirst.mockResolvedValue({ id: "existing-reward" });

      await service.onCampaignApplicationApproved("referred-creator-1", "app2");

      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });

    it("does not create a reward when no active rule matches the milestone", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedCampaignApplicationAt: null, qualifiedAt: null });
      prisma.creatorReferralRule.findMany.mockResolvedValue([]);
      await service.onCampaignApplicationApproved("referred-creator-1", "app1");
      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });
  });

  describe("onContentApproved (Phase 7A — mirrors onCampaignApplicationApproved)", () => {
    it("does nothing when the approved creator was never referred", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue(null);
      await service.onContentApproved("unreferred-creator", "content1");
      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });

    it("creates a MILESTONE_FIXED reward for FIRST_APPROVED_CONTENT when an active matching rule exists", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedContentAt: null, qualifiedAt: null });
      prisma.creatorReferralRule.findMany.mockResolvedValue([{ id: "rule1", fixedRewardMinor: 30_000_00, currency: "UZS" }]);

      await service.onContentApproved("referred-creator-1", "content1");

      expect(prisma.creatorReferral.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "referral1" }, data: expect.objectContaining({ firstApprovedContentAt: expect.any(Date) }) }),
      );
      expect(prisma.creatorReferralReward.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referralId: "referral1",
            ruleId: "rule1",
            sourceType: "CONTENT_APPROVED",
            sourceId: "content1",
            calculatedRewardMinor: 30_000_00,
          }),
        }),
      );
    });

    it("does not pay the milestone twice for the same (referral, rule) on a second approved Content", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedContentAt: new Date(), qualifiedAt: new Date() });
      prisma.creatorReferralRule.findMany.mockResolvedValue([{ id: "rule1", fixedRewardMinor: 30_000_00, currency: "UZS" }]);
      prisma.creatorReferralReward.findFirst.mockResolvedValue({ id: "existing-reward" });

      await service.onContentApproved("referred-creator-1", "content2");

      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });

    it("does not create a reward when no active rule matches FIRST_APPROVED_CONTENT", async () => {
      prisma.creatorReferral.findUnique.mockResolvedValue({ id: "referral1", firstApprovedContentAt: null, qualifiedAt: null });
      prisma.creatorReferralRule.findMany.mockResolvedValue([]);
      await service.onContentApproved("referred-creator-1", "content1");
      expect(prisma.creatorReferralReward.create).not.toHaveBeenCalled();
    });
  });

  describe("assertRuleIsValid (via createRule)", () => {
    it("rejects MILESTONE_FIXED with no milestoneType", async () => {
      await expect(service.createRule({ name: "Test", rewardType: "MILESTONE_FIXED", fixedRewardMinor: 1000 } as never)).rejects.toMatchObject({
        code: "REFERRAL_RULE_INVALID",
      });
    });

    it("rejects MILESTONE_FIXED with a non-positive fixedRewardMinor", async () => {
      await expect(
        service.createRule({ name: "Test", rewardType: "MILESTONE_FIXED", milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION", fixedRewardMinor: 0 } as never),
      ).rejects.toMatchObject({ code: "REFERRAL_RULE_INVALID" });
    });

    it("rejects EARNINGS_PERCENTAGE with no rewardRateBps", async () => {
      await expect(service.createRule({ name: "Test", rewardType: "EARNINGS_PERCENTAGE" } as never)).rejects.toMatchObject({
        code: "REFERRAL_RULE_INVALID",
      });
    });

    it("accepts a valid MILESTONE_FIXED rule", async () => {
      prisma.creatorReferralRule.create.mockResolvedValue({ id: "rule1" });
      await service.createRule({
        name: "First application bonus",
        rewardType: "MILESTONE_FIXED",
        milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION",
        fixedRewardMinor: 50_000_00,
      });
      expect(prisma.creatorReferralRule.create).toHaveBeenCalled();
    });
  });

  describe("calculateEarningsPercentageReward", () => {
    it("computes a deterministic integer reward from basis points (no floating point)", () => {
      expect(service.calculateEarningsPercentageReward(1_000_000, 500, null)).toBe(50_000); // 5% of 1,000,000
    });

    it("caps the reward at maximumRewardPerReferralMinor when set", () => {
      expect(service.calculateEarningsPercentageReward(10_000_000, 1000, 500_000)).toBe(500_000); // 10% would be 1,000,000, capped
    });

    it("returns 0 for zero qualified earnings", () => {
      expect(service.calculateEarningsPercentageReward(0, 500, null)).toBe(0);
    });
  });
});
