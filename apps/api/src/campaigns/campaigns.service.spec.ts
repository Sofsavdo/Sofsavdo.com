import { Test } from "@nestjs/testing";
import { CampaignsService } from "./campaigns.service";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignMediaService } from "../campaign-media/campaign-media.service";

describe("CampaignsService", () => {
  let service: CampaignsService;
  let prisma: {
    campaign: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    offer: { findUnique: jest.Mock };
    creatorCampaign: { count: jest.Mock };
  };

  const baseOffer = {
    id: "offer1",
    name: "Offer 1",
    slug: "offer-1",
    priceMinor: 100_000,
    compareAtPriceMinor: null,
    currency: "UZS",
    status: "ACTIVE",
    archivedAt: null,
    product: { id: "prod1", name: "Product 1", slug: "product-1", sku: "SKU-1", status: "ACTIVE", type: "PHYSICAL_PRODUCT" },
    landingPage: { status: "PUBLISHED" },
  };

  const baseCampaign = {
    id: "camp1",
    offerId: "offer1",
    name: "Test campaign",
    internalName: null,
    slug: "test-campaign",
    description: "desc",
    internalNotes: "SECRET internal notes",
    category: "beauty",
    ctaLabel: "Join",
    goal: null,
    targetAudience: null,
    platforms: ["INSTAGRAM"],
    contentFormats: ["reels"],
    requiredElements: [],
    forbiddenElements: [],
    referenceContent: [],
    minFollowers: null,
    maxFollowers: null,
    requiredContentCount: null,
    contentDeadline: null,
    startDate: null,
    endDate: null,
    applicationStartDate: null,
    applicationDeadline: null,
    creatorLimit: null,
    requiresApproval: true,
    commissionType: "PERCENTAGE" as const,
    commissionRateBps: 2000,
    commissionAmountMinor: null,
    commissionCurrency: "UZS",
    customerDiscountType: null,
    customerDiscountValue: null,
    barterEnabled: false,
    freeProduct: null,
    attributionWindowDays: 30,
    status: "DRAFT" as const,
    archivedAt: null,
    createdById: "user1",
    updatedById: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
    offer: baseOffer,
  };

  beforeEach(async () => {
    prisma = {
      campaign: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      offer: { findUnique: jest.fn() },
      creatorCampaign: { count: jest.fn().mockResolvedValue(0) },
    };
    const campaignMedia = { listCreatorSafe: jest.fn().mockResolvedValue([]), listCreatorSafeForCampaigns: jest.fn().mockResolvedValue(new Map()) };
    const moduleRef = await Test.createTestingModule({
      providers: [CampaignsService, { provide: PrismaService, useValue: prisma }, { provide: CampaignMediaService, useValue: campaignMedia }],
    }).compile();
    service = moduleRef.get(CampaignsService);
  });

  describe("computeAvailability", () => {
    const now = new Date("2026-06-15T00:00:00Z");

    it("is INACTIVE for any non-ACTIVE stored status", () => {
      for (const status of ["DRAFT", "PAUSED", "COMPLETED", "ARCHIVED"] as const) {
        expect(service.computeAvailability({ status, startDate: null, endDate: null }, now)).toBe("INACTIVE");
      }
    });

    it("is LIVE when ACTIVE with no date bounds", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startDate: null, endDate: null }, now)).toBe("LIVE");
    });

    it("is SCHEDULED when ACTIVE but startDate is in the future", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startDate: new Date("2026-07-01T00:00:00Z"), endDate: null }, now)).toBe("SCHEDULED");
    });

    it("is EXPIRED when ACTIVE but endDate has passed", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startDate: null, endDate: new Date("2026-06-01T00:00:00Z") }, now)).toBe("EXPIRED");
    });

    it("boundary: startDate exactly equal to now is LIVE, not SCHEDULED", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startDate: now, endDate: null }, now)).toBe("LIVE");
    });

    it("boundary: endDate exactly equal to now is LIVE, not EXPIRED", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startDate: null, endDate: now }, now)).toBe("LIVE");
    });
  });

  describe("computeApplicationAvailability", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const active = { status: "ACTIVE" as const, applicationStartDate: null, applicationDeadline: null, creatorLimit: null };

    it("is INACTIVE when campaign status isn't ACTIVE", () => {
      expect(service.computeApplicationAvailability({ ...active, status: "PAUSED" }, 0, now)).toBe("INACTIVE");
    });

    it("is NOT_STARTED before applicationStartDate", () => {
      expect(service.computeApplicationAvailability({ ...active, applicationStartDate: new Date("2026-07-01T00:00:00Z") }, 0, now)).toBe("NOT_STARTED");
    });

    it("is CLOSED after applicationDeadline", () => {
      expect(service.computeApplicationAvailability({ ...active, applicationDeadline: new Date("2026-06-01T00:00:00Z") }, 0, now)).toBe("CLOSED");
    });

    it("is FULL when approvedCreatorCount reaches creatorLimit", () => {
      expect(service.computeApplicationAvailability({ ...active, creatorLimit: 5 }, 5, now)).toBe("FULL");
    });

    it("is OPEN when active, within window, and under capacity", () => {
      expect(service.computeApplicationAvailability({ ...active, creatorLimit: 5 }, 4, now)).toBe("OPEN");
    });
  });

  describe("create", () => {
    const dto = {
      offerId: "offer1",
      name: "New campaign",
      slug: "new-campaign",
      category: "beauty",
      ctaLabel: "Join",
      commissionType: "PERCENTAGE" as const,
      commissionRateBps: 1000,
    };

    it("throws NOT_FOUND when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws SLUG_TAKEN when the slug is already used", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce({ id: "other", slug: "new-campaign" });
      await expect(service.create(dto, null)).rejects.toMatchObject({ code: "SLUG_TAKEN" });
    });

    it("rejects startDate not before endDate with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ ...dto, startDate: "2026-08-01T00:00:00Z", endDate: "2026-07-01T00:00:00Z" }, null),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects an out-of-bounds PERCENTAGE commission with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null);
      await expect(service.create({ ...dto, commissionRateBps: 10_001 }, null)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects a FIXED_AMOUNT commission exceeding the offer's price with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ ...dto, commissionType: "FIXED_AMOUNT", commissionRateBps: undefined, commissionAmountMinor: 200_000 }, null),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects PERCENTAGE commission with a commissionAmountMinor set (mutual exclusivity) with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null);
      await expect(service.create({ ...dto, commissionAmountMinor: 500 }, null)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("rejects FIXED_AMOUNT commission missing commissionAmountMinor with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create({ ...dto, commissionType: "FIXED_AMOUNT", commissionRateBps: undefined }, null),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("creates a DRAFT campaign when everything is valid", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.campaign.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(baseCampaign);
      prisma.campaign.create.mockResolvedValue({ id: "camp1" });
      const result = await service.create(dto, "actor1");
      expect(result.status).toBe("DRAFT");
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ offerId: "offer1", createdById: "actor1", updatedById: "actor1" }),
      });
    });
  });

  describe("update", () => {
    it("throws NOT_FOUND when the campaign doesn't exist", async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", {}, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("blocks edits once ARCHIVED", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: "ARCHIVED" });
      await expect(service.update("camp1", { name: "x" }, null)).rejects.toMatchObject({ code: "CAMPAIGN_ARCHIVED" });
    });
  });

  describe("status transitions", () => {
    it.each([
      ["DRAFT", "ACTIVE"],
      ["DRAFT", "ARCHIVED"],
      ["ACTIVE", "PAUSED"],
      ["ACTIVE", "COMPLETED"],
      ["PAUSED", "ACTIVE"],
      ["PAUSED", "COMPLETED"],
      ["PAUSED", "ARCHIVED"],
      ["COMPLETED", "ARCHIVED"],
    ])("allows %s -> %s", async (from, to) => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: from });
      prisma.campaign.update.mockResolvedValue({});
      const action =
        to === "ACTIVE" ? service.activate.bind(service) : to === "PAUSED" ? service.pause.bind(service) : to === "COMPLETED" ? service.complete.bind(service) : service.archive.bind(service);
      await expect(action("camp1", null)).resolves.toBeDefined();
    });

    it.each([
      ["ACTIVE", "ARCHIVED"], // must PAUSE or COMPLETE first, per the spec's explicit matrix
      ["DRAFT", "PAUSED"],
      ["DRAFT", "COMPLETED"],
      ["COMPLETED", "ACTIVE"],
      ["ARCHIVED", "ACTIVE"],
      ["ARCHIVED", "ARCHIVED"],
    ])("forbids %s -> %s with a typed INVALID_CAMPAIGN_TRANSITION", async (from, to) => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: from });
      const action =
        to === "ACTIVE" ? service.activate.bind(service) : to === "PAUSED" ? service.pause.bind(service) : to === "COMPLETED" ? service.complete.bind(service) : service.archive.bind(service);
      await expect(action("camp1", null)).rejects.toMatchObject({ code: "INVALID_CAMPAIGN_TRANSITION" });
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it("sets archivedAt when archiving", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: "COMPLETED" });
      prisma.campaign.update.mockResolvedValue({});
      await service.archive("camp1", "actor1");
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "camp1" },
        data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) }),
      });
    });
  });

  describe("activation eligibility", () => {
    const draft = { ...baseCampaign, status: "DRAFT" as const };

    it("blocks activation when the offer is archived", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...draft, offer: { ...baseOffer, archivedAt: new Date() } });
      await expect(service.activate("camp1", null)).rejects.toMatchObject({ code: "CAMPAIGN_NOT_ELIGIBLE", details: { reason: "OFFER_ARCHIVED" } });
    });

    it("blocks activation when the offer isn't ACTIVE", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...draft, offer: { ...baseOffer, status: "DRAFT" } });
      await expect(service.activate("camp1", null)).rejects.toMatchObject({ code: "CAMPAIGN_NOT_ELIGIBLE", details: { reason: "OFFER_NOT_ACTIVE" } });
    });

    it("blocks activation when the offer has no landing", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...draft, offer: { ...baseOffer, landingPage: null } });
      await expect(service.activate("camp1", null)).rejects.toMatchObject({ code: "CAMPAIGN_NOT_ELIGIBLE", details: { reason: "LANDING_MISSING" } });
    });

    it("blocks activation when the landing isn't PUBLISHED", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...draft, offer: { ...baseOffer, landingPage: { status: "DRAFT" } } });
      await expect(service.activate("camp1", null)).rejects.toMatchObject({ code: "CAMPAIGN_NOT_ELIGIBLE", details: { reason: "LANDING_NOT_PUBLISHED" } });
    });

    it("blocks activation when required config fields are missing", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...draft, platforms: [] });
      await expect(service.activate("camp1", null)).rejects.toMatchObject({ code: "CAMPAIGN_NOT_ELIGIBLE", details: { reason: "CONFIG_INCOMPLETE" } });
    });

    it("allows activation when every requirement is met", async () => {
      prisma.campaign.findUnique.mockResolvedValue(draft);
      prisma.campaign.update.mockResolvedValue({});
      await expect(service.activate("camp1", null)).resolves.toBeDefined();
    });
  });

  describe("list", () => {
    it("selects only summary fields from Offer/Product (no N+1)", async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20 });
      const args = prisma.campaign.findMany.mock.calls[0][0];
      expect(args.include.offer.select.product).toBeDefined();
      expect(args.include._count).toBeDefined();
    });

    it("filters by archived=true using archivedAt IS NOT NULL", async () => {
      prisma.campaign.findMany.mockResolvedValue([]);
      prisma.campaign.count.mockResolvedValue(0);
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, archived: true });
      expect(prisma.campaign.findMany.mock.calls[0][0].where.archivedAt).toEqual({ not: null });
    });
  });

  describe("creator-facing", () => {
    it("only returns LIVE campaigns from listForCreator", async () => {
      const now = new Date();
      prisma.campaign.findMany.mockResolvedValue([
        { ...baseCampaign, id: "c1", status: "ACTIVE" },
        { ...baseCampaign, id: "c2", status: "ACTIVE", startDate: new Date(now.getTime() + 86_400_000) }, // SCHEDULED
        { ...baseCampaign, id: "c3", status: "PAUSED" },
      ]);
      const result = await service.listForCreator({});
      expect(result.map((c) => c.id)).toEqual(["c1"]);
    });

    it("never leaks internalName/internalNotes/createdById/status in the creator response", async () => {
      prisma.campaign.findMany.mockResolvedValue([{ ...baseCampaign, status: "ACTIVE" }]);
      const [result] = await service.listForCreator({});
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("internalName");
      expect(serialized).not.toContain("internalNotes");
      expect(serialized).not.toContain("SECRET internal notes");
      expect(serialized).not.toContain("createdById");
      expect(serialized).not.toContain("updatedById");
      expect(serialized).not.toContain("archivedAt");
      expect(result).not.toHaveProperty("status");
    });

    it("findOneForCreatorOrThrow 404s (not a different error) for a PAUSED campaign — indistinguishable from nonexistent", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: "PAUSED" });
      await expect(service.findOneForCreatorOrThrow("camp1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("findOneForCreatorOrThrow 404s for a nonexistent campaign", async () => {
      prisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.findOneForCreatorOrThrow("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("findOneForCreatorOrThrow returns the campaign when LIVE", async () => {
      prisma.campaign.findUnique.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });
      await expect(service.findOneForCreatorOrThrow("camp1")).resolves.toMatchObject({ id: "camp1" });
    });
  });
});
