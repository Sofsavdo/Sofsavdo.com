import { Test } from "@nestjs/testing";
import { ActivityTickerService } from "./activity-ticker.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("ActivityTickerService", () => {
  let service: ActivityTickerService;
  let prisma: { commission: { findMany: jest.Mock }; payout: { findMany: jest.Mock }; creatorFundContribution: { findMany: jest.Mock } };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  const sale = (name: string, amountMinor: number, createdAt: Date) => ({ amountMinor, currency: "UZS", createdAt, creator: { displayName: name } });
  const payout = (name: string, amountMinor: number, paidAt: Date) => ({ amountMinor, currency: "UZS", paidAt, creator: { displayName: name } });
  const contribution = (name: string, amountMinor: number, createdAt: Date) => ({ amountMinor, currency: "UZS", createdAt, creator: { displayName: name } });

  beforeEach(async () => {
    prisma = {
      commission: { findMany: jest.fn().mockResolvedValue([]) },
      payout: { findMany: jest.fn().mockResolvedValue([]) },
      creatorFundContribution: { findMany: jest.fn().mockResolvedValue([]) },
    };
    cache = { buildKey: jest.fn().mockReturnValue("ticker-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [ActivityTickerService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(ActivityTickerService);
  });

  it("returns an empty feed when nothing happened recently", async () => {
    const result = await service.getFeed();
    expect(result).toEqual({ events: [] });
  });

  it("merges sale/payout/contribution streams and sorts them newest-first", async () => {
    const t0 = new Date("2026-07-29T10:00:00Z");
    const t1 = new Date("2026-07-29T11:00:00Z");
    const t2 = new Date("2026-07-29T12:00:00Z");
    prisma.commission.findMany.mockResolvedValue([sale("Malika", 5000, t0)]);
    prisma.payout.findMany.mockResolvedValue([payout("Aziz", 100_000, t2)]);
    prisma.creatorFundContribution.findMany.mockResolvedValue([contribution("Dilnoza", 20_000, t1)]);

    const result = await service.getFeed();

    expect(result.events.map((e) => e.type)).toEqual(["PAYOUT", "FUND_CONTRIBUTION", "SALE"]);
    expect(result.events[0]).toMatchObject({ creatorDisplayName: "Aziz", amountMinor: 100_000 });
  });

  it("excludes REJECTED/REFUNDED commissions from the sale stream", async () => {
    await service.getFeed();
    expect(prisma.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["REJECTED", "REFUNDED"] } }) }),
    );
  });

  it("only reads PAID payouts, never REQUESTED/PROCESSING ones", async () => {
    await service.getFeed();
    expect(prisma.payout.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "PAID" }) }));
  });

  it("reuses the cached feed on a cache hit instead of recomputing", async () => {
    cache.get.mockResolvedValue([{ type: "SALE", creatorDisplayName: "Me", amountMinor: 500, currency: "UZS", occurredAt: new Date() }]);
    const result = await service.getFeed();
    expect(prisma.commission.findMany).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(1);
  });

  it("caches the freshly-computed feed with a 20s TTL", async () => {
    await service.getFeed();
    expect(cache.set).toHaveBeenCalledWith("ticker-key", expect.any(Array), 20);
  });
});
