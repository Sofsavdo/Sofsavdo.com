import { Test } from "@nestjs/testing";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

function baseQuery(overrides: Partial<AnalyticsQueryDto> = {}): AnalyticsQueryDto {
  return { range: "this_month", compare: "none", page: 1, pageSize: 20, sortDir: "desc", ...overrides } as AnalyticsQueryDto;
}

describe("ExecutiveAnalyticsService", () => {
  let service: ExecutiveAnalyticsService;
  let prisma: {
    order: { groupBy: jest.Mock; count: jest.Mock };
    refund: { groupBy: jest.Mock };
    attribution: { groupBy: jest.Mock };
    referralVisit: { count: jest.Mock };
    campaign: { count: jest.Mock };
    product: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock; buildKey: jest.Mock };

  const statusGroupsFixture = [
    { status: "CREATED", _count: { _all: 2 }, _sum: { totalMinor: 0 } },
    { status: "PAID", _count: { _all: 5 }, _sum: { totalMinor: 500_000 } },
    { status: "REFUNDED", _count: { _all: 1 }, _sum: { totalMinor: 100_000 } },
  ];

  beforeEach(async () => {
    prisma = {
      order: {
        groupBy: jest.fn((args: { by: string[] }) => {
          if (args.by[0] === "status") return Promise.resolve(statusGroupsFixture);
          if (args.by[0] === "customerId") return Promise.resolve([]); // no order history by default
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(3), // attributedPaidOrdersCount
      },
      refund: { groupBy: jest.fn().mockResolvedValue([{ orderId: "order1", _sum: { amountMinor: 100_000 } }]) },
      attribution: { groupBy: jest.fn().mockResolvedValue([{ creatorId: "c1" }, { creatorId: "c2" }]) },
      referralVisit: { count: jest.fn().mockResolvedValue(10) },
      campaign: { count: jest.fn().mockResolvedValue(4) },
      product: { count: jest.fn().mockResolvedValue(7) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), buildKey: jest.fn().mockReturnValue("key") };

    const moduleRef = await Test.createTestingModule({
      providers: [ExecutiveAnalyticsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(ExecutiveAnalyticsService);
  });

  it("computes GMV (includes REFUNDED) and Revenue (excludes REFUNDED) per the approved definitions", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.gmvMinor).toBe(500_000 + 100_000); // PAID + REFUNDED
    expect(result.current.revenueMinor).toBe(500_000); // PAID only
  });

  it("computes Orders/Paid/Pending order counts from the status breakdown", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.ordersCount).toBe(2 + 5 + 1);
    expect(result.current.paidOrdersCount).toBe(5 + 1); // PAID + REFUNDED
    expect(result.current.pendingOrdersCount).toBe(2); // CREATED
  });

  it("computes Net Revenue as Revenue minus decided refund amounts", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.netRevenueMinor).toBe(500_000 - 100_000);
  });

  it("computes refund rate as refunded orders / paid orders", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.refundRate).toBeCloseTo(1 / 6); // 1 refunded order / (5+1) paid orders
  });

  it("computes AOV as GMV / paid orders (not Revenue / paid orders)", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.averageOrderValueMinor).toBe(Math.round(600_000 / 6));
  });

  it("computes Active Creators as the distinct-creatorId Attribution groupBy length", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.activeCreatorsCount).toBe(2);
  });

  it("labels conversion as creatorLinkConversionRate = attributed paid orders / visit count", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.creatorLinkConversionRate).toBeCloseTo(3 / 10);
  });

  it("includes snapshot counts (Active Campaigns/Products) only on `current`, never on `previous`", async () => {
    const result = await service.getSummary(baseQuery({ compare: "previous" }));
    expect(result.current.activeCampaignsCount).toBe(4);
    expect(result.current.activeProductsCount).toBe(7);
    expect(result.previous!.activeCampaignsCount).toBeUndefined();
    expect(result.previous!.activeProductsCount).toBeUndefined();
    expect(result.deltaPct).not.toHaveProperty("activeCampaignsCount");
  });

  it("surfaces the orders-by-status breakdown from the same groupBy call, not a second query", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.statusBreakdown).toEqual([
      { status: "CREATED", count: 2 },
      { status: "PAID", count: 5 },
      { status: "REFUNDED", count: 1 },
    ]);
  });

  it("computes a percent delta between current and previous for a comparable metric", async () => {
    // Same fixture returned for both current and previous here (groupBy isn't range-aware in this
    // mock), so delta should be exactly 0 for every comparable key.
    const result = await service.getSummary(baseQuery({ compare: "previous" }));
    expect(result.deltaPct!.revenueMinor).toBe(0);
  });

  it("returns the cached response and skips recomputation on a cache hit", async () => {
    const cached = { current: { gmvMinor: 1 }, trend: [] };
    cache.get.mockResolvedValueOnce(cached);
    const result = await service.getSummary(baseQuery());
    expect(result).toBe(cached);
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
  });

  it("new/returning customers are both 0 when no orders exist in the period", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.current.newCustomers).toBe(0);
    expect(result.current.returningCustomers).toBe(0);
  });
});
