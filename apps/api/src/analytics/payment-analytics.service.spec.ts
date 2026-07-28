import { Test } from "@nestjs/testing";
import { PaymentAnalyticsService } from "./payment-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

function baseQuery(overrides: Partial<AnalyticsQueryDto> = {}): AnalyticsQueryDto {
  return { range: "this_month", compare: "none", page: 1, pageSize: 20, sortDir: "desc", ...overrides } as AnalyticsQueryDto;
}

describe("PaymentAnalyticsService", () => {
  let service: PaymentAnalyticsService;
  let prisma: { payment: { groupBy: jest.Mock }; refund: { groupBy: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock; buildKey: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payment: {
        groupBy: jest.fn().mockResolvedValue([
          { provider: "CLICK", status: "PAID", _count: { _all: 8 }, _sum: { amountMinor: 800_000 } },
          { provider: "CLICK", status: "PENDING", _count: { _all: 2 }, _sum: { amountMinor: 200_000 } },
          { provider: "CASH_ON_DELIVERY", status: "PAID", _count: { _all: 5 }, _sum: { amountMinor: 500_000 } },
          { provider: "CLICK", status: "FAILED", _count: { _all: 1 }, _sum: { amountMinor: 100_000 } },
        ]),
      },
      refund: { groupBy: jest.fn().mockResolvedValue([{ status: "APPROVED", _sum: { amountMinor: 50_000 } }]) },
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), buildKey: jest.fn().mockReturnValue("key") };

    const moduleRef = await Test.createTestingModule({
      providers: [PaymentAnalyticsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(PaymentAnalyticsService);
  });

  it("throws VALIDATION_ERROR for an unrecognized payment status filter", async () => {
    await expect(service.getSummary(baseQuery({ status: "NOT_A_STATUS" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("computes success rate as PAID count / total count across all methods", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.totalCount).toBe(8 + 2 + 5 + 1);
    expect(result.successRate).toBeCloseTo((8 + 5) / 16);
  });

  it("computes pending as PENDING + PROCESSING, and failed as FAILED", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.pendingCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it("groups amount/count by provider across every status", async () => {
    const result = await service.getSummary(baseQuery());
    const click = result.byMethod.find((m) => m.provider === "CLICK")!;
    expect(click.count).toBe(8 + 2 + 1);
    expect(click.amountMinor).toBe(800_000 + 200_000 + 100_000);
  });

  it("sums decided-refund amounts as refundsMinor", async () => {
    const result = await service.getSummary(baseQuery());
    expect(result.refundsMinor).toBe(50_000);
  });
});
