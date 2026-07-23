import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { CreatorApplicationsService } from "./creator-applications.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { ReferralsService } from "../referrals/referrals.service";
import { PrismaService } from "../prisma/prisma.service";

function serializationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("could not serialize access", { code: "P2034", clientVersion: "test" });
}

// The shape @prisma/adapter-pg actually throws for a Postgres SQLSTATE 40001 (serialization
// failure) in this project's driver-adapter setup — NOT a PrismaClientKnownRequestError with
// P2034. A real concurrency e2e test caught this (see DECISIONS.md / creator-applications.service.ts)
// after the P2034-only check let a real conflict fall through as an unhandled 500.
function driverAdapterConflictError(): Error {
  const err = new Error("TransactionWriteConflict");
  err.name = "DriverAdapterError";
  (err as unknown as { cause: { kind: string } }).cause = { kind: "TransactionWriteConflict" };
  return err;
}

describe("CreatorApplicationsService", () => {
  let service: CreatorApplicationsService;
  let prisma: {
    campaignApplication: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    campaign: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    creatorProfile: { findUnique: jest.Mock };
    creatorCampaign: { count: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let campaigns: { computeAvailability: jest.Mock; computeApplicationAvailability: jest.Mock };

  const baseCampaign = {
    id: "camp1",
    status: "ACTIVE" as const,
    startDate: null,
    endDate: null,
    applicationStartDate: null,
    applicationDeadline: null,
    minFollowers: null,
    maxFollowers: null,
    platforms: ["INSTAGRAM"],
    creatorLimit: null as number | null,
    requiresApproval: true,
  };

  const baseCreatorProfile = {
    id: "creator1",
    user: { status: "ACTIVE" as const },
    socialAccounts: [] as { followerCount: number }[],
  };

  const withRelations = (over: Record<string, unknown>) => ({
    id: "app1",
    campaignId: "camp1",
    creatorId: "creator1",
    status: "DRAFT",
    message: null,
    platform: null,
    contentFormat: null,
    portfolioLinks: [],
    sampleContentLinks: [],
    answers: null,
    followerSnapshot: null,
    adminNotes: null,
    rejectionReason: null,
    changesRequestedReason: null,
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    withdrawnAt: null,
    reviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: "creator1", displayName: "Test Creator", city: null },
    campaign: { id: "camp1", name: "Campaign", slug: "campaign", category: "beauty", creatorLimit: null, status: "ACTIVE" },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      campaignApplication: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      campaign: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      creatorProfile: { findUnique: jest.fn() },
      creatorCampaign: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      $transaction: jest.fn(),
    };
    // Runs the callback against the same mock — tx.* and prisma.* are interchangeable for these
    // tests since there's no real Postgres to isolate a transaction against.
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma));

    campaigns = { computeAvailability: jest.fn().mockReturnValue("LIVE"), computeApplicationAvailability: jest.fn().mockReturnValue("OPEN") };
    const referrals = { onCampaignApplicationSubmitted: jest.fn(), onCampaignApplicationApproved: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreatorApplicationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CampaignsService, useValue: campaigns },
        { provide: ReferralsService, useValue: referrals },
      ],
    }).compile();
    service = moduleRef.get(CreatorApplicationsService);

    prisma.campaign.findUnique.mockResolvedValue(baseCampaign);
    prisma.campaign.findUniqueOrThrow.mockResolvedValue(baseCampaign);
    prisma.creatorProfile.findUnique.mockResolvedValue(baseCreatorProfile);
  });

  describe("create — eligibility gate", () => {
    it("throws ALREADY_APPLIED when a row already exists for this (campaign, creator) pair", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ id: "existing" });
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({ code: "ALREADY_APPLIED" });
    });

    it("throws NOT_FOUND when the campaign doesn't exist", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws APPLICATION_NOT_ELIGIBLE (CAMPAIGN_NOT_LIVE) when the campaign isn't LIVE", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      campaigns.computeAvailability.mockReturnValue("SCHEDULED");
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "CAMPAIGN_NOT_LIVE" },
      });
    });

    it("throws CAMPAIGN_FULL when application availability is FULL", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      campaigns.computeApplicationAvailability.mockReturnValue("FULL");
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({ code: "CAMPAIGN_FULL" });
    });

    it("throws APPLICATION_NOT_ELIGIBLE with the raw reason for any other non-OPEN application availability", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      campaigns.computeApplicationAvailability.mockReturnValue("CLOSED");
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "CLOSED" },
      });
    });

    it("throws NOT_FOUND when the creator profile doesn't exist", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.creatorProfile.findUnique.mockResolvedValue(null);
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws APPLICATION_NOT_ELIGIBLE (ACCOUNT_INACTIVE) when the creator's user isn't ACTIVE", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.creatorProfile.findUnique.mockResolvedValue({ ...baseCreatorProfile, user: { status: "SUSPENDED" } });
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "ACCOUNT_INACTIVE" },
      });
    });

    it("throws APPLICATION_NOT_ELIGIBLE (BELOW_MIN_FOLLOWERS) below the campaign's minimum", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, minFollowers: 1000 });
      prisma.creatorProfile.findUnique.mockResolvedValue({ ...baseCreatorProfile, socialAccounts: [{ followerCount: 500 }] });
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "BELOW_MIN_FOLLOWERS" },
      });
    });

    it("throws APPLICATION_NOT_ELIGIBLE (ABOVE_MAX_FOLLOWERS) above the campaign's maximum", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, maxFollowers: 1000 });
      prisma.creatorProfile.findUnique.mockResolvedValue({ ...baseCreatorProfile, socialAccounts: [{ followerCount: 5000 }] });
      await expect(service.create("camp1", "creator1", {})).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "ABOVE_MAX_FOLLOWERS" },
      });
    });

    it("uses the highest follower count across multiple social accounts", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, minFollowers: 1000 });
      prisma.creatorProfile.findUnique.mockResolvedValueOnce({
        ...baseCreatorProfile,
        socialAccounts: [{ followerCount: 100 }, { followerCount: 5000 }],
      });
      prisma.creatorProfile.findUnique.mockResolvedValueOnce({
        ...baseCreatorProfile,
        socialAccounts: [{ followerCount: 100 }, { followerCount: 5000 }],
      });
      prisma.campaignApplication.create.mockResolvedValue({ id: "app1" });
      prisma.campaignApplication.findUnique.mockResolvedValueOnce(null).mockResolvedValue(withRelations({ followerSnapshot: 5000 }));
      await service.create("camp1", "creator1", {});
      expect(prisma.campaignApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ followerSnapshot: 5000, status: "DRAFT" }) }),
      );
    });

    it("throws APPLICATION_NOT_ELIGIBLE (PLATFORM_MISMATCH) when the chosen platform isn't offered by the campaign", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      await expect(service.create("camp1", "creator1", { platform: "TIKTOK" })).rejects.toMatchObject({
        code: "APPLICATION_NOT_ELIGIBLE",
        details: { reason: "PLATFORM_MISMATCH" },
      });
    });

    it("creates a DRAFT application when every eligibility check passes", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValueOnce(null).mockResolvedValue(withRelations({}));
      prisma.campaignApplication.create.mockResolvedValue({ id: "app1" });
      const result = await service.create("camp1", "creator1", { message: "pick me" });
      expect(result.status).toBe("DRAFT");
      expect(prisma.campaignApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ campaignId: "camp1", creatorId: "creator1", status: "DRAFT" }) }),
      );
    });
  });

  describe("ownership", () => {
    it("findMineOrThrow 404s (not FORBIDDEN) when the application belongs to a different creator", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ creatorId: "someone-else" }));
      await expect(service.findMineOrThrow("app1", "creator1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("findMineOrThrow 404s for a nonexistent id", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      await expect(service.findMineOrThrow("missing", "creator1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("findMineOrThrow returns the owner's own application", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({}));
      await expect(service.findMineOrThrow("app1", "creator1")).resolves.toMatchObject({ id: "app1" });
    });
  });

  describe("creator-safe response mapping", () => {
    it("never includes adminNotes or reviewedById", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(
        withRelations({ adminNotes: "internal-only note", reviewedById: "admin-user-1" }),
      );
      const result = await service.findMineOrThrow("app1", "creator1");
      expect(result).not.toHaveProperty("adminNotes");
      expect(result).not.toHaveProperty("reviewedById");
      expect(JSON.stringify(result)).not.toContain("internal-only note");
    });
  });

  describe("updateDraft", () => {
    it.each(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"])(
      "blocks editing from %s with INVALID_APPLICATION_TRANSITION",
      async (status) => {
        prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status }));
        await expect(service.updateDraft("app1", "creator1", {})).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
        expect(prisma.campaignApplication.update).not.toHaveBeenCalled();
      },
    );

    it.each(["DRAFT", "CHANGES_REQUESTED"])("allows editing from %s", async (status) => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await expect(service.updateDraft("app1", "creator1", { message: "updated" })).resolves.toBeDefined();
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "app1" }, data: expect.objectContaining({ message: "updated" }) }),
      );
    });
  });

  describe("submit", () => {
    it("throws INVALID_APPLICATION_TRANSITION unless the application is DRAFT", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "SUBMITTED" }));
      await expect(service.submit("app1", "creator1")).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
    });

    it("re-validates eligibility at submit time (blocks if the campaign is no longer LIVE)", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      campaigns.computeAvailability.mockReturnValue("EXPIRED");
      await expect(service.submit("app1", "creator1")).rejects.toMatchObject({ code: "APPLICATION_NOT_ELIGIBLE" });
    });

    it("moves DRAFT -> SUBMITTED when the campaign requires approval", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.submit("app1", "creator1");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED", submittedAt: expect.any(Date) }) }),
      );
      expect(prisma.creatorCampaign.create).not.toHaveBeenCalled();
    });

    it("instantly approves and creates a CreatorCampaign when the campaign does not require approval", async () => {
      prisma.campaign.findUniqueOrThrow.mockResolvedValue({ ...baseCampaign, requiresApproval: false });
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.submit("app1", "creator1");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", approvedAt: expect.any(Date) }) }),
      );
      expect(prisma.creatorCampaign.create).toHaveBeenCalledWith({
        data: { campaignId: "camp1", creatorId: "creator1", status: "ACTIVE" },
      });
    });

    it("instant-join path still enforces capacity — CAMPAIGN_FULL when the limit is already reached", async () => {
      prisma.campaign.findUniqueOrThrow.mockResolvedValue({ ...baseCampaign, requiresApproval: false, creatorLimit: 1 });
      // The capacity-safe transaction re-fetches the application with its campaign relation —
      // that nested campaign needs creatorLimit set too, since it (not the earlier
      // findUniqueOrThrow call) is what approveCapacitySafe actually checks capacity against.
      prisma.campaignApplication.findUnique.mockResolvedValue(
        withRelations({ status: "DRAFT", campaign: { id: "camp1", name: "Campaign", slug: "campaign", category: "beauty", creatorLimit: 1, status: "ACTIVE" } }),
      );
      prisma.creatorCampaign.count.mockResolvedValue(1);
      await expect(service.submit("app1", "creator1")).rejects.toMatchObject({ code: "CAMPAIGN_FULL" });
      expect(prisma.campaignApplication.update).not.toHaveBeenCalled();
    });
  });

  describe("resubmit", () => {
    it("throws INVALID_APPLICATION_TRANSITION unless the application is CHANGES_REQUESTED", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      await expect(service.resubmit("app1", "creator1")).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
    });

    it("moves CHANGES_REQUESTED -> SUBMITTED", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "CHANGES_REQUESTED" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.resubmit("app1", "creator1");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED" }) }),
      );
    });
  });

  describe("withdraw", () => {
    it.each(["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"])("allows withdrawal from %s", async (status) => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await expect(service.withdraw("app1", "creator1")).resolves.toBeDefined();
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "WITHDRAWN", withdrawnAt: expect.any(Date) }) }),
      );
    });

    it.each(["DRAFT", "APPROVED", "REJECTED", "WITHDRAWN"])("blocks withdrawal from %s", async (status) => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status }));
      await expect(service.withdraw("app1", "creator1")).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
    });
  });

  describe("listMyCampaigns — merged status synthesis", () => {
    function withMembership(appStatus: string, membership: { status: string } | null) {
      prisma.campaignApplication.findMany.mockResolvedValue([
        {
          id: "app1",
          campaignId: "camp1",
          status: appStatus,
          submittedAt: new Date("2026-01-01"),
          createdAt: new Date("2026-01-01"),
          rejectionReason: null,
          campaign: { id: "camp1", name: "Campaign" },
        },
      ]);
      prisma.creatorCampaign.count.mockResolvedValue(0);
      // listMyCampaigns queries creatorCampaign.findMany, not count — reuse the same mock object.
      (prisma.creatorCampaign as unknown as { findMany: jest.Mock }).findMany = jest
        .fn()
        .mockResolvedValue(membership ? [{ campaignId: "camp1", ...membership }] : []);
    }

    it("maps to ACTIVE when the membership is ACTIVE", async () => {
      withMembership("APPROVED", { status: "ACTIVE" });
      const [result] = await service.listMyCampaigns("creator1");
      expect(result!.status).toBe("ACTIVE");
    });

    it("maps to COMPLETED when the membership has ENDED", async () => {
      withMembership("APPROVED", { status: "ENDED" });
      const [result] = await service.listMyCampaigns("creator1");
      expect(result!.status).toBe("COMPLETED");
    });

    it.each([
      ["SUBMITTED", "APPLIED"],
      ["UNDER_REVIEW", "UNDER_REVIEW"],
      ["CHANGES_REQUESTED", "CHANGES_REQUESTED"],
      ["REJECTED", "REJECTED"],
      ["WITHDRAWN", "CANCELLED"],
    ])("maps application status %s to %s when there's no membership yet", async (appStatus, expected) => {
      withMembership(appStatus, null);
      const [result] = await service.listMyCampaigns("creator1");
      expect(result!.status).toBe(expected);
    });
  });

  describe("admin — startReview", () => {
    it("throws NOT_FOUND for a missing application", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      await expect(service.startReview("missing", "admin1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws INVALID_APPLICATION_TRANSITION unless SUBMITTED", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      await expect(service.startReview("app1", "admin1")).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
    });

    it("moves SUBMITTED -> UNDER_REVIEW and records the reviewer", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "SUBMITTED" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.startReview("app1", "admin1");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "UNDER_REVIEW", reviewedById: "admin1" }) }),
      );
    });
  });

  describe("admin — reject / requestChanges", () => {
    it.each(["reject", "requestChanges"] as const)("%s throws INVALID_APPLICATION_TRANSITION unless UNDER_REVIEW", async (method) => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "SUBMITTED" }));
      await expect(service[method]("app1", "admin1", "not eligible enough")).rejects.toMatchObject({
        code: "INVALID_APPLICATION_TRANSITION",
      });
    });

    it("reject sets REJECTED with the reason, terminal timestamps, and reviewer", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "UNDER_REVIEW" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.reject("app1", "admin1", "Not a fit for this campaign");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REJECTED",
            rejectionReason: "Not a fit for this campaign",
            rejectedAt: expect.any(Date),
            reviewedById: "admin1",
          }),
        }),
      );
    });

    it("requestChanges sets CHANGES_REQUESTED with the reason and reviewer, no terminal timestamp", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(withRelations({ status: "UNDER_REVIEW" }));
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.requestChanges("app1", "admin1", "Please add portfolio links");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CHANGES_REQUESTED", changesRequestedReason: "Please add portfolio links", reviewedById: "admin1" }),
        }),
      );
    });
  });

  describe("admin — approve (capacity-safe)", () => {
    it("throws INVALID_APPLICATION_TRANSITION unless UNDER_REVIEW", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ ...withRelations({ status: "SUBMITTED" }), campaign: baseCampaign });
      await expect(service.approve("app1", "admin1")).rejects.toMatchObject({ code: "INVALID_APPLICATION_TRANSITION" });
    });

    it("throws CAMPAIGN_FULL when approvedCount already meets creatorLimit", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({
        ...withRelations({ status: "UNDER_REVIEW" }),
        campaign: { ...baseCampaign, creatorLimit: 2 },
      });
      prisma.creatorCampaign.count.mockResolvedValue(2);
      await expect(service.approve("app1", "admin1")).rejects.toMatchObject({ code: "CAMPAIGN_FULL" });
      expect(prisma.creatorCampaign.create).not.toHaveBeenCalled();
    });

    it("approves and atomically creates the CreatorCampaign membership", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({
        ...withRelations({ status: "UNDER_REVIEW", submittedAt: new Date("2026-01-01") }),
        campaign: { ...baseCampaign, creatorLimit: null },
      });
      prisma.campaignApplication.update.mockResolvedValue({});
      await service.approve("app1", "admin1");
      expect(prisma.campaignApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", reviewedById: "admin1" }) }),
      );
      expect(prisma.creatorCampaign.create).toHaveBeenCalledWith({
        data: { campaignId: "camp1", creatorId: "creator1", status: "ACTIVE" },
      });
    });

    it("retries once on a transient serialization conflict, then succeeds", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({
        ...withRelations({ status: "UNDER_REVIEW" }),
        campaign: { ...baseCampaign, creatorLimit: null },
      });
      prisma.campaignApplication.update.mockResolvedValue({});
      let attempt = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) => {
        attempt += 1;
        if (attempt === 1) throw serializationError();
        return cb(prisma);
      });
      await expect(service.approve("app1", "admin1")).resolves.toBeDefined();
      expect(attempt).toBe(2);
    });

    it("surfaces a typed CAMPAIGN_FULL after the retry also hits a serialization conflict", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({
        ...withRelations({ status: "UNDER_REVIEW" }),
        campaign: { ...baseCampaign, creatorLimit: null },
      });
      prisma.$transaction.mockImplementation(async () => {
        throw serializationError();
      });
      await expect(service.approve("app1", "admin1")).rejects.toMatchObject({ code: "CAMPAIGN_FULL" });
    });

    it("also recognizes the real @prisma/adapter-pg DriverAdapterError conflict shape (not just P2034)", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({
        ...withRelations({ status: "UNDER_REVIEW" }),
        campaign: { ...baseCampaign, creatorLimit: null },
      });
      prisma.$transaction.mockImplementation(async () => {
        throw driverAdapterConflictError();
      });
      await expect(service.approve("app1", "admin1")).rejects.toMatchObject({ code: "CAMPAIGN_FULL" });
    });
  });

  describe("admin — list", () => {
    beforeEach(() => {
      prisma.campaignApplication.findMany.mockResolvedValue([]);
      prisma.campaignApplication.count.mockResolvedValue(0);
    });

    it("filters by status/campaignId/creatorId/platform", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, status: "SUBMITTED", campaignId: "camp1", creatorId: "creator1", platform: "INSTAGRAM" });
      const args = prisma.campaignApplication.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({ status: "SUBMITTED", campaignId: "camp1", creatorId: "creator1", platform: "INSTAGRAM" });
    });

    it("builds an insensitive OR search across creator name and campaign name/internalName", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, search: "acme" });
      const args = prisma.campaignApplication.findMany.mock.calls[0][0];
      expect(args.where.OR).toHaveLength(3);
    });

    it("defaults sort to createdAt desc and rejects non-whitelisted sortBy", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, sortBy: "message" });
      const args = prisma.campaignApplication.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });

    it("honors an allowed sortBy override", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, sortBy: "submittedAt", sortDir: "asc" });
      const args = prisma.campaignApplication.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ submittedAt: "asc" });
    });
  });
});
