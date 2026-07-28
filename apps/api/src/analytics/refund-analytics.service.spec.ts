import { Test } from "@nestjs/testing";
import { RefundAnalyticsService } from "./refund-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

function baseQuery(overrides: Partial<AnalyticsQueryDto> = {}): AnalyticsQueryDto {
  return { range: "this_month", compare: "none", page: 1, pageSize: 20, sortDir: "desc", ...overrides } as AnalyticsQueryDto;
}

describe("RefundAnalyticsService", () => {
  let service: RefundAnalyticsService;
  let prisma: { refund: { groupBy: jest.Mock; aggregate: jest.Mock }; order: { count: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock; buildKey: jest.Mock };

  beforeEach(async () => {
    prisma = {
      refund: {
        groupBy: jest.fn((args: { by: string[] }) => {
          if (args.by[0] === "status") {
            return Promise.resolve([
              { status: "APPROVED", _count: { _all: 3 } },
              { status: "PROCESSED", _count: { _all: 2 } },
              { status: "REJECTED", _count: { _all: 1 } },
            ]);
          }
          if (args.by[0] === "reason") {
            return Promise.resolve([
              { reason: "Mahsulot nosoz", _count: { _all: 4 } },
              { reason: "Fikr o'zgardi", _count: { _all: 2 } },
            ]);
          }
          return Promise.resolve([]);
        }),
        aggregate: jest.fn().mockResolvedValue({ _avg: { amountMinor: 50_000 }, _sum: { amountMinor: 250_000 }, _count: { _all: 5 } }),
      },
      order: { count: jest.fn().mockResolvedValue(20) },
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), buildKey: jest.fn().mockReturnValue("key") };

    const moduleRef = await Test.createTestingModule({
      providers: [RefundAnalyticsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(RefundAnalyticsService);
  });

  it("throws VALIDATION_ERROR for an unrecognized status filter", async () => {
    await expect(service.getSummary(baseQuery({ status: "NOT_A_STATUS" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("computes approval rate as (approved + processed) / all decided", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.approvalRate).toBeCloseTo((3 + 2) / (3 + 2 + 1));
  });

  it("computes refund rate as decided refunds / paid orders", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.refundRate).toBeCloseTo(5 / 20);
  });

  it("computes average and total refunded amount from the decided-status aggregate", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.averageRefundAmountMinor).toBe(50_000);
    expect(result.totalRefundedMinor).toBe(250_000);
  });

  it("ranks raw reason strings by frequency without normalization", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.topReasons).toEqual([
      { reason: "Mahsulot nosoz", count: 4 },
      { reason: "Fikr o'zgardi", count: 2 },
    ]);
  });

  it("requestedCount sums every refund status, not just decided ones", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.requestedCount).toBe(3 + 2 + 1);
  });
});
