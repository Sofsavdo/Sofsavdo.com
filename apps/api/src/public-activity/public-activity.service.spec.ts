import { Test } from "@nestjs/testing";
import { PublicActivityService } from "./public-activity.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("PublicActivityService", () => {
  let service: PublicActivityService;
  let prisma: { order: { findMany: jest.Mock } };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = { order: { findMany: jest.fn().mockResolvedValue([]) } };
    cache = { buildKey: jest.fn().mockReturnValue("activity-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [PublicActivityService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(PublicActivityService);
  });

  it("returns an empty feed when no order has ever been paid yet", async () => {
    const result = await service.getRecentActivity();
    expect(result).toEqual([]);
  });

  it("returns real order rows without any creator name, amount, or commission data", async () => {
    const createdAt = new Date("2026-07-29T10:00:00Z");
    prisma.order.findMany.mockResolvedValue([{ createdAt, offer: { name: "Vitamin C serum" }, address: { city: "Toshkent" } }]);

    const result = await service.getRecentActivity();

    expect(result).toEqual([{ offerName: "Vitamin C serum", city: "Toshkent", occurredAt: createdAt }]);
  });

  it("only queries PAID/DELIVERED orders", async () => {
    await service.getRecentActivity();
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["PAID", "DELIVERED"] } } }),
    );
  });

  it("falls back to a null city when the order has no delivery address (e.g. a digital product)", async () => {
    prisma.order.findMany.mockResolvedValue([{ createdAt: new Date(), offer: { name: "Onlayn kurs" }, address: null }]);
    const result = await service.getRecentActivity();
    expect(result[0]!.city).toBeNull();
  });

  it("serves from cache on a hit, without querying the database", async () => {
    const cached = [{ offerName: "Cached offer", city: "Samarqand", occurredAt: new Date() }];
    cache.get.mockResolvedValue(cached);

    const result = await service.getRecentActivity();

    expect(result).toEqual(cached);
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
