import { Test } from "@nestjs/testing";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

function baseQuery(overrides: Partial<AnalyticsQueryDto> = {}): AnalyticsQueryDto {
  return { range: "this_month", compare: "none", page: 1, pageSize: 20, sortDir: "desc", ...overrides } as AnalyticsQueryDto;
}

describe("CustomerAnalyticsService", () => {
  let service: CustomerAnalyticsService;
  let prisma: { order: { groupBy: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock; buildKey: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), buildKey: jest.fn().mockReturnValue("key") };
  });

  async function build() {
    const moduleRef = await Test.createTestingModule({
      providers: [CustomerAnalyticsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    return moduleRef.get(CustomerAnalyticsService);
  }

  it("returns all zeros when no customer ordered in the period", async () => {
    prisma = { order: { groupBy: jest.fn().mockResolvedValue([]) } };
    service = await build();
    const result = await service.getSummary(baseQuery());
    expect(result).toMatchObject({ activeCustomersCount: 0, newCustomersCount: 0, returningCustomersCount: 0, averageLifetimeValueMinor: 0, averageOrderFrequency: 0 });
  });

  it("classifies a customer as new when their first-ever order falls inside the period", async () => {
    // Relative to "now" (not a hardcoded date) so this test doesn't silently start failing once
    // the calendar moves past whatever month it was written in — "this_month" resolves against
    // the real system clock (see time-range.resolver.ts), so a fixed date drifts out of range.
    const now = new Date();
    const inPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
    prisma = {
      order: {
        groupBy: jest.fn((args: { where?: { customerId?: unknown } }) => {
          if (args.where?.customerId && typeof args.where.customerId === "object" && "in" in (args.where.customerId)) {
            return Promise.resolve([{ customerId: "cust1", _min: { createdAt: inPeriod }, _count: { _all: 1 }, _sum: { totalMinor: 100_000 } }]);
          }
          return Promise.resolve([{ customerId: "cust1" }]);
        }),
      },
    };
    service = await build();
    const result = await service.getSummary(baseQuery({ range: "this_month" }));
    expect(result.newCustomersCount).toBe(1);
    expect(result.returningCustomersCount).toBe(0);
  });

  it("classifies a customer as returning when their all-time order count is >= 2", async () => {
    prisma = {
      order: {
        groupBy: jest.fn((args: { where?: { customerId?: unknown } }) => {
          if (args.where?.customerId && typeof args.where.customerId === "object" && "in" in (args.where.customerId)) {
            return Promise.resolve([{ customerId: "cust1", _min: { createdAt: new Date(2020, 0, 1) }, _count: { _all: 3 }, _sum: { totalMinor: 300_000 } }]);
          }
          return Promise.resolve([{ customerId: "cust1" }]);
        }),
      },
    };
    service = await build();
    const result = await service.getSummary(baseQuery());
    expect(result.returningCustomersCount).toBe(1);
    expect(result.newCustomersCount).toBe(0);
    expect(result.averageOrderFrequency).toBe(3);
    expect(result.averageLifetimeValueMinor).toBe(300_000);
  });
});
