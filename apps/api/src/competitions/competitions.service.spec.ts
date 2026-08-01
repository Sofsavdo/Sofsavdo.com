import { Test } from "@nestjs/testing";
import { CompetitionsService } from "./competitions.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { DomainException } from "../common/errors/domain-error";

describe("CompetitionsService", () => {
  let service: CompetitionsService;
  let prisma: { competition: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  const base = {
    id: "comp1",
    name: "Yozgi musobaqa",
    slug: "yozgi-musobaqa",
    description: null,
    prizeDescription: null,
    metric: "ORDER_COUNT" as const,
    firstPrize: "Prize 1",
    secondPrize: "Prize 2",
    thirdPrize: "Prize 3",
    imageUrl: null,
    startAt: new Date("2026-08-01T00:00:00Z"),
    endAt: new Date("2026-08-31T00:00:00Z"),
    status: "DRAFT" as const,
    archivedAt: null,
    createdById: null,
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      competition: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
    };
    cache = { buildKey: jest.fn().mockReturnValue("comp-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [CompetitionsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(CompetitionsService);
  });

  describe("computeAvailability", () => {
    const now = new Date("2026-08-15T00:00:00Z");

    it("is INACTIVE when status isn't ACTIVE, regardless of dates", () => {
      expect(service.computeAvailability({ status: "DRAFT", startAt: base.startAt, endAt: base.endAt }, now)).toBe("INACTIVE");
    });

    it("is SCHEDULED when startAt is in the future", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: new Date("2026-09-01"), endAt: new Date("2026-09-30") }, now)).toBe("SCHEDULED");
    });

    it("is EXPIRED when endAt is in the past", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: new Date("2026-07-01"), endAt: new Date("2026-07-31") }, now)).toBe("EXPIRED");
    });

    it("is LIVE when ACTIVE and within the date window", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: base.startAt, endAt: base.endAt }, now)).toBe("LIVE");
    });
  });

  describe("create", () => {
    it("rejects startAt >= endAt", async () => {
      await expect(
        service.create(
          { 
            name: "x", 
            startAt: "2026-08-31T00:00:00Z", 
            endAt: "2026-08-01T00:00:00Z",
            metric: "ORDER_COUNT",
            firstPrize: "Prize 1",
            secondPrize: "Prize 2",
            thirdPrize: "Prize 3"
          }, 
          null
        )
      ).rejects.toThrow(DomainException);
    });

    it("creates with DRAFT status by default (via the model default, not passed explicitly)", async () => {
      prisma.competition.findUnique.mockResolvedValue(null);
      prisma.competition.create.mockResolvedValue(base);
      await service.create(
        { 
          name: "Yozgi musobaqa", 
          startAt: "2026-08-01T00:00:00Z", 
          endAt: "2026-08-31T00:00:00Z",
          metric: "ORDER_COUNT",
          firstPrize: "Prize 1",
          secondPrize: "Prize 2",
          thirdPrize: "Prize 3"
        }, 
        "user1"
      );
      expect(prisma.competition.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });
  });

  describe("transitions (publish/complete/archive)", () => {
    it("allows DRAFT -> ACTIVE via publish", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      prisma.competition.update.mockResolvedValue({ ...base, status: "ACTIVE" });
      const result = await service.publish("comp1", "user1");
      expect(result.status).toBe("ACTIVE");
    });

    it("rejects DRAFT -> COMPLETED (must go through ACTIVE first)", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      await expect(service.complete("comp1", "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });

    it("rejects any transition out of ARCHIVED", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await expect(service.publish("comp1", "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });

    it("sets archivedAt when transitioning to ARCHIVED", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ACTIVE" });
      prisma.competition.update.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await service.archive("comp1", "user1");
      expect(prisma.competition.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) }));
    });
  });

  describe("update", () => {
    it("rejects editing an ARCHIVED competition", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await expect(service.update("comp1", { name: "new name" }, "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });
  });

  describe("listActiveForCreators", () => {
    it("only returns ACTIVE-status competitions whose computed availability is LIVE or SCHEDULED", async () => {
      const now = Date.now();
      prisma.competition.findMany.mockResolvedValue([
        { ...base, id: "live", status: "ACTIVE", startAt: new Date(now - 1000), endAt: new Date(now + 1_000_000) },
        { ...base, id: "scheduled", status: "ACTIVE", startAt: new Date(now + 1_000_000), endAt: new Date(now + 2_000_000) },
        { ...base, id: "expired", status: "ACTIVE", startAt: new Date(now - 2_000_000), endAt: new Date(now - 1_000_000) },
      ]);
      const result = await service.listActiveForCreators();
      expect(result.map((c) => c.id)).toEqual(["live", "scheduled"]);
      // the query itself is already scoped to status: ACTIVE — DRAFT/ARCHIVED are never fetched
      expect(prisma.competition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" } }));
    });
  });

  describe("getLeaderboard", () => {
    it("404s when the competition doesn't exist", async () => {
      prisma.competition.findUnique.mockResolvedValue(null);
      await expect(service.getLeaderboard("missing", "creator1")).rejects.toThrow(DomainException);
    });

    it("reuses the cached ranking on a hit and finds the requester's own rank", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      cache.get.mockResolvedValue([{ creatorId: "creator1", displayName: "Me", commissionMinor: 1000, ordersCount: 1 }]);
      const result = await service.getLeaderboard("comp1", "creator1");
      expect(result.me).toMatchObject({ rank: 1, creatorId: "creator1" });
    });
  });
});

