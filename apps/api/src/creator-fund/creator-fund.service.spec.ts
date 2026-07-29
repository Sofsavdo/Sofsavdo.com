import { Test } from "@nestjs/testing";
import { CreatorFundService } from "./creator-fund.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import { AuditService } from "../common/audit/audit.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("CreatorFundService", () => {
  let service: CreatorFundService;
  let prisma: {
    $transaction: jest.Mock;
    creatorFundContribution: { create: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
    creatorProfile: { findMany: jest.Mock };
  };
  let commissions: { contributeToFund: jest.Mock };
  let audit: { record: jest.Mock };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      creatorFundContribution: {
        create: jest.fn().mockResolvedValue({ id: "fund1", amountMinor: 10_000_00, currency: "UZS", message: null, createdAt: new Date() }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: null } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      creatorProfile: { findMany: jest.fn().mockResolvedValue([]) },
    };
    commissions = { contributeToFund: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn() };
    cache = { buildKey: jest.fn().mockReturnValue("fund-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreatorFundService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommissionsService, useValue: commissions },
        { provide: AuditService, useValue: audit },
        { provide: AnalyticsCacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(CreatorFundService);
  });

  describe("contribute", () => {
    it("rejects a non-positive amount before touching the database", async () => {
      await expect(service.contribute("creator1", "user1", { amountMinor: 0 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("creates the contribution row and locks/settles commissions in the same transaction", async () => {
      const result = await service.contribute("creator1", "user1", { amountMinor: 10_000_00, message: "Omad tilaymiz!" });
      expect(prisma.creatorFundContribution.create).toHaveBeenCalledWith({ data: { creatorId: "creator1", amountMinor: 10_000_00, message: "Omad tilaymiz!" } });
      expect(commissions.contributeToFund).toHaveBeenCalledWith(prisma, "creator1", 10_000_00, "fund1");
      expect(result).toMatchObject({ id: "fund1", amountMinor: 10_000_00 });
    });

    it("records an audit entry for the contribution", async () => {
      await service.contribute("creator1", "user1", { amountMinor: 10_000_00 });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: "user1", action: "FUND_CONTRIBUTION_CREATED", entityId: "fund1" }));
    });
  });

  describe("getStats", () => {
    it("computes the platform total on a cache miss and caches it for 30s", async () => {
      prisma.creatorFundContribution.aggregate.mockResolvedValueOnce({ _sum: { amountMinor: 500_000_00 } }).mockResolvedValueOnce({ _sum: { amountMinor: 20_000_00 } });
      const stats = await service.getStats("creator1");
      expect(stats).toEqual({ totalMinor: 500_000_00, currency: "UZS", myTotalMinor: 20_000_00 });
      expect(cache.set).toHaveBeenCalledWith("fund-key", 500_000_00, 30);
    });

    it("reuses the cached platform total but always recomputes the creator's own total fresh", async () => {
      cache.get.mockResolvedValue(999_000_00);
      prisma.creatorFundContribution.aggregate.mockResolvedValue({ _sum: { amountMinor: 15_000_00 } });
      const stats = await service.getStats("creator1");
      expect(stats.totalMinor).toBe(999_000_00);
      expect(stats.myTotalMinor).toBe(15_000_00);
      expect(prisma.creatorFundContribution.aggregate).toHaveBeenCalledTimes(1); // only "mine", platform total came from cache
    });
  });

  describe("getLeaderboard", () => {
    it("ranks contributors by lifetime totalMinor descending and finds the requester outside the top N", async () => {
      prisma.creatorFundContribution.groupBy.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({ creatorId: `c${i}`, _sum: { amountMinor: (25 - i) * 1000 } })),
      );
      prisma.creatorProfile.findMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, displayName: `Creator ${i}` })));

      const result = await service.getLeaderboard("c24");

      expect(result.top).toHaveLength(20);
      expect(result.top[0]).toMatchObject({ rank: 1, creatorId: "c0", totalMinor: 25_000 });
      expect(result.me).toMatchObject({ rank: 25, creatorId: "c24" });
    });

    it("returns an empty top list and me: null when nobody has contributed yet", async () => {
      const result = await service.getLeaderboard("creator1");
      expect(result).toEqual({ top: [], me: null });
    });

    it("reuses the cached ranking on a cache hit instead of recomputing", async () => {
      cache.get.mockResolvedValue([{ creatorId: "creator1", displayName: "Me", totalMinor: 500 }]);
      const result = await service.getLeaderboard("creator1");
      expect(prisma.creatorFundContribution.groupBy).not.toHaveBeenCalled();
      expect(result.me).toMatchObject({ rank: 1, creatorId: "creator1" });
    });
  });
});
