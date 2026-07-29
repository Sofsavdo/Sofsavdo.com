import { Test } from "@nestjs/testing";
import { CreatorLeaderboardService } from "./creator-leaderboard.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("CreatorLeaderboardService", () => {
  let service: CreatorLeaderboardService;
  let prisma: { commission: { groupBy: jest.Mock }; creatorProfile: { findMany: jest.Mock } };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = { commission: { groupBy: jest.fn().mockResolvedValue([]) }, creatorProfile: { findMany: jest.fn().mockResolvedValue([]) } };
    cache = { buildKey: jest.fn().mockReturnValue("lb-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [CreatorLeaderboardService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(CreatorLeaderboardService);
  });

  it("returns an empty top list and me: null when nobody has a Commission this month", async () => {
    const result = await service.getLeaderboard("creator1");
    expect(result).toEqual({ period: "this_month", top: [], me: null });
    expect(prisma.creatorProfile.findMany).not.toHaveBeenCalled();
  });

  it("ranks by commissionMinor descending, assigns 1-based rank, and finds the requester even outside the top N", async () => {
    prisma.commission.groupBy.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({ creatorId: `c${i}`, _sum: { amountMinor: (25 - i) * 1000 }, _count: { _all: 1 } })),
    );
    prisma.creatorProfile.findMany.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, displayName: `Creator ${i}` })));

    const result = await service.getLeaderboard("c24"); // lowest earner — rank 25, outside top 20

    expect(result.top).toHaveLength(20);
    expect(result.top[0]).toMatchObject({ rank: 1, creatorId: "c0", commissionMinor: 25_000 });
    expect(result.top[19]).toMatchObject({ rank: 20, creatorId: "c19" });
    expect(result.me).toMatchObject({ rank: 25, creatorId: "c24" });
  });

  it("excludes REJECTED/REFUNDED from the ranking query", async () => {
    await service.getLeaderboard("creator1");
    expect(prisma.commission.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["REJECTED", "REFUNDED"] } }) }),
    );
  });

  it("reuses the cached ranking on a cache hit instead of recomputing", async () => {
    cache.get.mockResolvedValue([{ creatorId: "creator1", displayName: "Me", commissionMinor: 500, ordersCount: 1 }]);
    const result = await service.getLeaderboard("creator1");
    expect(prisma.commission.groupBy).not.toHaveBeenCalled();
    expect(result.me).toMatchObject({ rank: 1, creatorId: "creator1" });
  });

  it("caches the freshly-computed ranking with a 60s TTL", async () => {
    await service.getLeaderboard("creator1");
    expect(cache.set).toHaveBeenCalledWith("lb-key", expect.any(Array), 60);
  });
});
