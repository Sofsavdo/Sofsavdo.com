import { Test } from "@nestjs/testing";
import { LandingsService } from "./landings.service";
import { PrismaService } from "../prisma/prisma.service";
import { OffersService } from "../offers/offers.service";
import { DeliveryService } from "../delivery/delivery.service";

describe("LandingsService", () => {
  let service: LandingsService;
  let prisma: {
    offer: { findUnique: jest.Mock };
    landingPage: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    landingSection: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let offers: { computeAvailability: jest.Mock };

  const baseLanding = {
    id: "landing1",
    offerId: "offer1",
    template: "default",
    status: "DRAFT" as const,
    publishedAt: null,
    archivedAt: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: [] as string[],
    ogImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseOffer = {
    id: "offer1",
    productId: "prod1",
    slug: "test-offer",
    name: "Test offer",
    headline: "Headline",
    subheadline: null,
    priceMinor: 10_000,
    compareAtPriceMinor: null,
    currency: "UZS",
    bonuses: null,
    deliveryInfo: null,
    paymentOptions: ["CLICK"],
    installmentOptions: null,
    ctaType: "BUY_NOW",
    ctaLabel: null,
    startsAt: null,
    expiresAt: null,
    status: "ACTIVE" as const,
    internalDescription: "SECRET internal notes",
    createdById: "user1",
    updatedById: "user1",
    variants: [{ id: "v1", name: "Standard", priceMinor: 10_000, isDefault: true, sortOrder: 0 }],
    product: { id: "prod1", type: "DIGITAL_PRODUCT", sku: "SKU-1", costPriceMinor: 500, internalNotes: "SECRET cost notes" },
  };

  beforeEach(async () => {
    prisma = {
      offer: { findUnique: jest.fn() },
      landingPage: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      landingSection: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma))),
    };
    offers = { computeAvailability: jest.fn().mockReturnValue("LIVE") };
    const delivery = { listActiveRegionsForOffer: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LandingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OffersService, useValue: offers },
        { provide: DeliveryService, useValue: delivery },
      ],
    }).compile();
    service = moduleRef.get(LandingsService);
  });

  describe("create", () => {
    it("throws NOT_FOUND when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.create("missing", {}, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws LANDING_ALREADY_EXISTS when a landing for this offer already exists", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue(baseLanding);
      await expect(service.create("offer1", {}, null)).rejects.toMatchObject({ code: "LANDING_ALREADY_EXISTS" });
    });

    it("creates a DRAFT landing with defaults when none exists", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue(null);
      prisma.landingPage.create.mockResolvedValue(baseLanding);

      const result = await service.create("offer1", {}, "actor1");

      expect(result.status).toBe("DRAFT");
      expect(prisma.landingPage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ offerId: "offer1", template: "default", seoKeywords: [], createdById: "actor1", updatedById: "actor1" }),
      });
    });
  });

  describe("update", () => {
    it("throws NOT_FOUND when no landing exists for the offer", async () => {
      prisma.landingPage.findUnique.mockResolvedValue(null);
      await expect(service.update("offer1", {}, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("blocks edits once ARCHIVED", async () => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: "ARCHIVED" });
      await expect(service.update("offer1", { template: "alt" }, null)).rejects.toMatchObject({ code: "LANDING_ARCHIVED" });
    });

    it("updates a DRAFT/PUBLISHED landing", async () => {
      prisma.landingPage.findUnique.mockResolvedValue(baseLanding);
      prisma.landingPage.update.mockResolvedValue({ ...baseLanding, seoTitle: "New title" });
      const result = await service.update("offer1", { seoTitle: "New title" }, "actor1");
      expect(result.seoTitle).toBe("New title");
    });
  });

  describe("status transitions", () => {
    it.each([
      ["DRAFT", "PUBLISHED"],
      ["DRAFT", "ARCHIVED"],
      ["PUBLISHED", "DRAFT"],
      ["PUBLISHED", "ARCHIVED"],
    ])("allows %s -> %s", async (from, to) => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: from });
      prisma.landingPage.update.mockResolvedValue({ ...baseLanding, status: to });

      const action = to === "PUBLISHED" ? service.publish.bind(service) : to === "DRAFT" ? service.unpublish.bind(service) : service.archive.bind(service);
      await expect(action("offer1", null)).resolves.toMatchObject({ status: to });
    });

    it.each([
      ["ARCHIVED", "PUBLISHED"],
      ["ARCHIVED", "DRAFT"],
      ["ARCHIVED", "ARCHIVED"],
      ["DRAFT", "DRAFT"],
      ["PUBLISHED", "PUBLISHED"],
    ])("forbids %s -> %s with a typed INVALID_LANDING_TRANSITION", async (from, to) => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: from });
      const action = to === "PUBLISHED" ? service.publish.bind(service) : to === "DRAFT" ? service.unpublish.bind(service) : service.archive.bind(service);
      await expect(action("offer1", null)).rejects.toMatchObject({ code: "INVALID_LANDING_TRANSITION" });
      expect(prisma.landingPage.update).not.toHaveBeenCalled();
    });

    it("sets publishedAt on first publish and never clears it on unpublish", async () => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: "DRAFT" });
      prisma.landingPage.update.mockResolvedValue({});
      await service.publish("offer1", "actor1");
      expect(prisma.landingPage.update).toHaveBeenCalledWith({
        where: { offerId: "offer1" },
        data: expect.objectContaining({ status: "PUBLISHED", publishedAt: expect.any(Date) }),
      });
    });

    it("sets archivedAt when archiving and leaves it set", async () => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: "PUBLISHED" });
      prisma.landingPage.update.mockResolvedValue({});
      await service.archive("offer1", "actor1");
      expect(prisma.landingPage.update).toHaveBeenCalledWith({
        where: { offerId: "offer1" },
        data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) }),
      });
    });

    it("throws NOT_FOUND transitioning a landing that doesn't exist", async () => {
      prisma.landingPage.findUnique.mockResolvedValue(null);
      await expect(service.publish("missing", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("sections", () => {
    it("blocks adding a section once the landing is ARCHIVED", async () => {
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: "ARCHIVED" });
      await expect(service.addSection("offer1", { type: "HERO" })).rejects.toMatchObject({ code: "LANDING_ARCHIVED" });
    });

    it("assigns the next sortOrder when creating a section", async () => {
      prisma.landingPage.findUnique.mockResolvedValue(baseLanding);
      prisma.landingSection.count.mockResolvedValue(2);
      prisma.landingSection.create.mockResolvedValue({ id: "sec1", landingPageId: "landing1", type: "FAQ", sortOrder: 2, isActive: true, content: {} });

      await service.addSection("offer1", { type: "FAQ" });

      expect(prisma.landingSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ landingPageId: "landing1", type: "FAQ", sortOrder: 2, isActive: true }),
      });
    });

    it("rejects reorder when orderedIds doesn't exactly match the existing section set", async () => {
      prisma.landingPage.findUnique.mockResolvedValue(baseLanding);
      prisma.landingSection.findMany.mockResolvedValue([{ id: "sec1" }, { id: "sec2" }]);
      await expect(service.reorderSections("offer1", ["sec1"])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("throws NOT_FOUND updating a section that doesn't exist", async () => {
      prisma.landingSection.findUnique.mockResolvedValue(null);
      await expect(service.updateSection("missing", { isActive: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("public read", () => {
    it("returns null when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.getPublicByOfferSlug("missing")).resolves.toBeNull();
    });

    it("returns null when the offer is archived", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...baseOffer, status: "ARCHIVED" });
      await expect(service.getPublicByOfferSlug("test-offer")).resolves.toBeNull();
    });

    it("returns null when no landing exists for the offer", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue(null);
      await expect(service.getPublicByOfferSlug("test-offer")).resolves.toBeNull();
    });

    it.each(["DRAFT", "ARCHIVED"] as const)("returns null when the landing is %s (not PUBLISHED)", async (status) => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status, sections: [] });
      await expect(service.getPublicByOfferSlug("test-offer")).resolves.toBeNull();
    });

    it("returns a curated payload — never internalDescription/createdById/product cost fields — when PUBLISHED", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue({
        ...baseLanding,
        status: "PUBLISHED",
        sections: [
          { id: "sec1", landingPageId: "landing1", type: "HERO", sortOrder: 0, isActive: true, content: {} },
          { id: "sec2", landingPageId: "landing1", type: "FAQ", sortOrder: 1, isActive: false, content: {} },
        ],
      });

      const result = await service.getPublicByOfferSlug("test-offer");

      expect(result).not.toBeNull();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("internalDescription");
      expect(serialized).not.toContain("SECRET internal notes");
      expect(serialized).not.toContain("createdById");
      expect(serialized).not.toContain("costPriceMinor");
      expect(serialized).not.toContain("internalNotes");
      expect(serialized).not.toContain("SECRET cost notes");
      // Inactive sections are filtered out of the public payload.
      expect(result!.sections).toHaveLength(1);
      expect(result!.sections[0]!.type).toBe("HERO");
      expect(result!.offer.availability).toBe("LIVE");
      expect(result!.productType).toBe("DIGITAL_PRODUCT");
    });
  });

  describe("preview", () => {
    it("throws NOT_FOUND when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.preview("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND when no landing exists yet", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue(null);
      await expect(service.preview("offer1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns the payload for a DRAFT landing (preview bypasses the publish gate)", async () => {
      prisma.offer.findUnique.mockResolvedValue(baseOffer);
      prisma.landingPage.findUnique.mockResolvedValue({ ...baseLanding, status: "DRAFT", sections: [] });
      await expect(service.preview("offer1")).resolves.toMatchObject({ productType: "DIGITAL_PRODUCT" });
    });
  });
});
