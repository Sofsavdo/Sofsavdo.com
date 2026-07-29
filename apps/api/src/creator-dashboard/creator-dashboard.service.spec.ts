import { Test } from "@nestjs/testing";
import { CreatorDashboardService } from "./creator-dashboard.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("CreatorDashboardService", () => {
  let service: CreatorDashboardService;
  let prisma: {
    commission: { count: jest.Mock; aggregate: jest.Mock };
    referralVisit: { count: jest.Mock };
    attribution: { count: jest.Mock };
    creatorProfile: { findUniqueOrThrow: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let commissions: { getWalletBalance: jest.Mock };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  const wallet = { pendingMinor: 1, availableMinor: 2, lockedMinor: 3, paidMinor: 4, reversedMinor: 5, currency: "UZS", minimumPayoutMinor: 100 };

  beforeEach(async () => {
    prisma = {
      commission: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { baseAmountMinor: 0, amountMinor: 0 } }) },
      referralVisit: { count: jest.fn().mockResolvedValue(0) },
      attribution: { count: jest.fn().mockResolvedValue(0) },
      creatorProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ bioComplianceStatus: "PENDING", tier: "STANDARD" }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    commissions = { getWalletBalance: jest.fn().mockResolvedValue(wallet) };
    cache = { buildKey: jest.fn().mockReturnValue("cache-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreatorDashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommissionsService, useValue: commissions },
        { provide: AnalyticsCacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(CreatorDashboardService);
  });

  it("returns the cached result without recomputing when present", async () => {
    const cachedStats = { today: {}, monthToDate: {}, lifetime: {}, wallet, dailyRevenue30d: [] };
    cache.get.mockResolvedValue(cachedStats);

    const result = await service.getStats("creator1");

    expect(result).toBe(cachedStats);
    expect(prisma.commission.count).not.toHaveBeenCalled();
    expect(commissions.getWalletBalance).not.toHaveBeenCalled();
  });

  it("excludes REJECTED/REFUNDED from the earnings aggregate but not from ordersCount", async () => {
    await service.getStats("creator1");

    // ordersCount uses the bare where (no status filter)
    expect(prisma.commission.count).toHaveBeenCalledWith({ where: expect.not.objectContaining({ status: expect.anything() }) });
    // the earnings aggregate explicitly excludes REJECTED/REFUNDED
    expect(prisma.commission.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["REJECTED", "REFUNDED"] } }) }),
    );
  });

  it("computes conversionRate as 0 (not NaN/Infinity) when there were no clicks today", async () => {
    prisma.referralVisit.count.mockResolvedValue(0);
    const result = await service.getStats("creator1");
    expect(result.today.conversionRate).toBe(0);
  });

  it("computes a real conversionRate from clicks vs orders when clicks exist", async () => {
    prisma.referralVisit.count.mockResolvedValue(10);
    prisma.commission.count.mockResolvedValue(2);
    const result = await service.getStats("creator1");
    expect(result.today.clicks).toBe(10);
    expect(result.today.ordersCount).toBe(2);
    expect(result.today.conversionRate).toBeCloseTo(0.2);
  });

  it("reuses CommissionsService.getWalletBalance rather than re-deriving pending/available/locked", async () => {
    const result = await service.getStats("creator1");
    expect(commissions.getWalletBalance).toHaveBeenCalledWith("creator1");
    expect(result.wallet).toBe(wallet);
  });

  it("fills every day in the 30-day window with 0, not just days that had a real Commission row", async () => {
    const today = new Date();
    prisma.$queryRaw.mockResolvedValue([{ day: today, revenueMinor: 5000n }]);

    const result = await service.getStats("creator1");

    expect(result.dailyRevenue30d).toHaveLength(30);
    const todayKey = today.toISOString().slice(0, 10);
    const todayPoint = result.dailyRevenue30d.find((p) => p.date === todayKey);
    expect(todayPoint?.revenueMinor).toBe(5000);
    const zeroDays = result.dailyRevenue30d.filter((p) => p.revenueMinor === 0);
    expect(zeroDays.length).toBe(29);
  });

  it("caches the freshly-computed result after a cache miss", async () => {
    await service.getStats("creator1");
    expect(cache.set).toHaveBeenCalledWith("cache-key", expect.any(Object), 30);
  });

  describe("funnel", () => {
    it("scopes clicks/orders/paidOrders to this creator via ReferralVisit/Attribution, not platform-wide", async () => {
      await service.getStats("creator1");
      expect(prisma.attribution.count).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ creatorId: "creator1" }) }));
      expect(prisma.attribution.count).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: expect.objectContaining({ creatorId: "creator1", order: { status: { in: expect.any(Array) } } }) }),
      );
    });

    it("computes conversionRate as paidOrders/clicks, 0 when there were no clicks this month", async () => {
      prisma.referralVisit.count.mockResolvedValue(0);
      const result = await service.getStats("creator1");
      expect(result.funnel).toEqual({ period: "this_month", clicks: 0, orders: 0, paidOrders: 0, conversionRate: 0 });
    });

    it("computes a real conversionRate from clicks vs paidOrders when both exist", async () => {
      prisma.referralVisit.count.mockResolvedValue(20);
      prisma.attribution.count.mockResolvedValueOnce(8).mockResolvedValueOnce(4);
      const result = await service.getStats("creator1");
      expect(result.funnel).toMatchObject({ clicks: 20, orders: 8, paidOrders: 4, conversionRate: 0.2 });
    });
  });

  describe("compliance", () => {
    it("surfaces the creator's own bioComplianceStatus/tier from CreatorProfile", async () => {
      prisma.creatorProfile.findUniqueOrThrow.mockResolvedValue({ bioComplianceStatus: "NON_COMPLIANT", tier: "STANDARD" });
      const result = await service.getStats("creator1");
      expect(result.compliance).toEqual({ bioComplianceStatus: "NON_COMPLIANT", tier: "STANDARD" });
    });
  });
});
