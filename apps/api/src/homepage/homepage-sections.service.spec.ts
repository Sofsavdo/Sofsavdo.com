import { Test } from "@nestjs/testing";
import { HomepageSectionsService } from "./homepage-sections.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

describe("HomepageSectionsService", () => {
  let service: HomepageSectionsService;
  let prisma: {
    homepageSection: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const baseSection = {
    id: "sec1",
    type: "HERO" as const,
    sortOrder: 0,
    isActive: true,
    content: {},
    startsAt: null as Date | null,
    expiresAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      homepageSection: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma))),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [HomepageSectionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(HomepageSectionsService);
  });

  describe("computeAvailability", () => {
    const now = new Date("2026-07-29T00:00:00Z");

    it("is INACTIVE when isActive is false, regardless of the date window", () => {
      expect(service.computeAvailability({ isActive: false, startsAt: null, expiresAt: null }, now)).toBe("INACTIVE");
    });

    it("is SCHEDULED when startsAt is in the future", () => {
      expect(service.computeAvailability({ isActive: true, startsAt: new Date("2026-08-01"), expiresAt: null }, now)).toBe("SCHEDULED");
    });

    it("is EXPIRED when expiresAt is in the past", () => {
      expect(service.computeAvailability({ isActive: true, startsAt: null, expiresAt: new Date("2026-07-01") }, now)).toBe("EXPIRED");
    });

    it("is LIVE when active with no window or within it", () => {
      expect(service.computeAvailability({ isActive: true, startsAt: null, expiresAt: null }, now)).toBe("LIVE");
      expect(service.computeAvailability({ isActive: true, startsAt: new Date("2026-07-01"), expiresAt: new Date("2026-08-01") }, now)).toBe("LIVE");
    });
  });

  describe("add", () => {
    it("appends to the end using the current count as sortOrder", async () => {
      prisma.homepageSection.count.mockResolvedValue(3);
      prisma.homepageSection.create.mockResolvedValue({ ...baseSection, sortOrder: 3 });
      await service.add({ type: "FAQ" });
      expect(prisma.homepageSection.create).toHaveBeenCalledWith({
        data: { type: "FAQ", content: {}, isActive: true, sortOrder: 3, startsAt: null, expiresAt: null },
      });
    });

    it("converts ISO startsAt/expiresAt strings to Date", async () => {
      prisma.homepageSection.count.mockResolvedValue(0);
      prisma.homepageSection.create.mockResolvedValue(baseSection);
      await service.add({ type: "BANNER", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" });
      expect(prisma.homepageSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ startsAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-09-01T00:00:00.000Z") }),
      });
    });
  });

  describe("update", () => {
    it("404s when the section does not exist", async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { isActive: false })).rejects.toThrow(DomainException);
    });

    it("clears startsAt/expiresAt when explicitly passed null", async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(baseSection);
      prisma.homepageSection.update.mockResolvedValue(baseSection);
      await service.update("sec1", { startsAt: null, expiresAt: null });
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({
        where: { id: "sec1" },
        data: { content: undefined, isActive: undefined, startsAt: null, expiresAt: null },
      });
    });

    it("leaves startsAt/expiresAt untouched when omitted", async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(baseSection);
      prisma.homepageSection.update.mockResolvedValue(baseSection);
      await service.update("sec1", { isActive: false });
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({
        where: { id: "sec1" },
        data: { content: undefined, isActive: false, startsAt: undefined, expiresAt: undefined },
      });
    });
  });

  describe("remove", () => {
    it("404s when the section does not exist", async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(null);
      await expect(service.remove("missing")).rejects.toThrow(DomainException);
    });

    it("deletes and re-sequences the remaining sections' sortOrder", async () => {
      prisma.homepageSection.findUnique.mockResolvedValue(baseSection);
      prisma.homepageSection.findMany.mockResolvedValue([
        { ...baseSection, id: "sec2", sortOrder: 1 },
        { ...baseSection, id: "sec3", sortOrder: 2 },
      ]);
      prisma.homepageSection.update.mockResolvedValue(baseSection);
      await service.remove("sec1");
      expect(prisma.homepageSection.delete).toHaveBeenCalledWith({ where: { id: "sec1" } });
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({ where: { id: "sec2" }, data: { sortOrder: 0 } });
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({ where: { id: "sec3" }, data: { sortOrder: 1 } });
    });
  });

  describe("reorder", () => {
    it("rejects an orderedIds array that doesn't exactly match the existing set", async () => {
      prisma.homepageSection.findMany.mockResolvedValue([{ id: "sec1" }, { id: "sec2" }]);
      await expect(service.reorder(["sec1"])).rejects.toThrow(DomainException);
      await expect(service.reorder(["sec1", "sec-unknown"])).rejects.toThrow(DomainException);
    });

    it("whole-array-replaces sortOrder by array index", async () => {
      prisma.homepageSection.findMany.mockResolvedValueOnce([{ id: "sec1" }, { id: "sec2" }]).mockResolvedValueOnce([]);
      prisma.homepageSection.update.mockResolvedValue(baseSection);
      await service.reorder(["sec2", "sec1"]);
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({ where: { id: "sec2" }, data: { sortOrder: 0 } });
      expect(prisma.homepageSection.update).toHaveBeenCalledWith({ where: { id: "sec1" }, data: { sortOrder: 1 } });
    });
  });

  describe("listPublic", () => {
    it("returns only LIVE sections (filters inactive, scheduled, expired) and drops admin-only fields", async () => {
      const now = Date.now();
      prisma.homepageSection.findMany.mockResolvedValue([
        { ...baseSection, id: "live", isActive: true, sortOrder: 0 },
        { ...baseSection, id: "inactive", isActive: false, sortOrder: 1 },
        { ...baseSection, id: "scheduled", isActive: true, sortOrder: 2, startsAt: new Date(now + 1_000_000) },
        { ...baseSection, id: "expired", isActive: true, sortOrder: 3, expiresAt: new Date(now - 1_000_000) },
      ]);
      const result = await service.listPublic();
      expect(result).toEqual([{ type: "HERO", sortOrder: 0, content: {} }]);
    });
  });
});
