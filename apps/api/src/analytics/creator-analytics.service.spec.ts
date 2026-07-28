import { Test } from "@nestjs/testing";
import { CreatorAnalyticsService } from "./creator-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";
import type { AnalyticsQueryDto } from "./dto/analytics-query.dto";

function baseQuery(overrides: Partial<AnalyticsQueryDto> = {}): AnalyticsQueryDto {
  return { range: "this_month", compare: "none", page: 1, pageSize: 20, sortDir: "desc", ...overrides } as AnalyticsQueryDto;
}

describe("CreatorAnalyticsService", () => {
  let service: CreatorAnalyticsService;
  let prisma: {
    $queryRaw: jest.Mock;
    referralVisit: { groupBy: jest.Mock; count: jest.Mock };
    creatorProfile: { findMany: jest.Mock; findUnique: jest.Mock };
    commission: { groupBy: jest.Mock };
    order: { groupBy: jest.Mock };
    campaign: { findMany: jest.Mock };
    offer: { findMany: jest.Mock };
    campaignApplication: { groupBy: jest.Mock };
    payout: { aggregate: jest.Mock };
    creatorReferral: { findMany: jest.Mock };
    creatorReferralReward: { aggregate: jest.Mock };
  };
  let cache: { get: jest.Mock; set: jest.Mock; buildKey: jest.Mock };

  beforeEach(async () => {
    prisma = {
      // creatorRevenueBreakdown's raw SQL join — returns pre-aggregated per-creator rows.
      $queryRaw: jest.fn().mockResolvedValue([{ creatorId: "creator1", ordersCount: 4n, revenueMinor: 400_000n }]),
      referralVisit: {
        groupBy: jest.fn().mockResolvedValue([{ creatorId: "creator1", _count: { _all: 20 } }]),
        count: jest.fn().mockResolvedValue(20),
      },
      creatorProfile: {
        findMany: jest.fn().mockResolvedValue([{ id: "creator1", displayName: "Malika" }]),
        findUnique: jest.fn().mockResolvedValue({ id: "creator1", displayName: "Malika" }),
      },
      commission: { groupBy: jest.fn().mockResolvedValue([{ status: "PAYABLE", _sum: { amountMinor: 120_000 } }]) },
      order: { groupBy: jest.fn().mockResolvedValue([]) },
      campaign: { findMany: jest.fn().mockResolvedValue([]) },
      offer: { findMany: jest.fn().mockResolvedValue([]) },
      campaignApplication: { groupBy: jest.fn().mockResolvedValue([{ status: "APPROVED", _count: { _all: 3 } }, { status: "REJECTED", _count: { _all: 1 } }]) },
      payout: { aggregate: jest.fn().mockResolvedValue({ _avg: { amountMinor: 90_000 } }) },
      creatorReferral: { findMany: jest.fn().mockResolvedValue([{ id: "r1", qualifiedAt: new Date() }, { id: "r2", qualifiedAt: null }]) },
      creatorReferralReward: { aggregate: jest.fn().mockResolvedValue({ _sum: { calculatedRewardMinor: 50_000 } }) },
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), buildKey: jest.fn().mockReturnValue("key") };

    const moduleRef = await Test.createTestingModule({
      providers: [CreatorAnalyticsService, { provide: PrismaService, useValue: prisma }, { provide: AnalyticsCacheService, useValue: cache }],
    }).compile();
    service = moduleRef.get(CreatorAnalyticsService);
  });

  it("list() converts raw-SQL bigint fields to numbers and computes conversion rate from clicks", async () => {
    const result = await service.list(baseQuery());
    expect(result.items).toEqual([{ creatorId: "creator1", displayName: "Malika", ordersCount: 4, revenueMinor: 400_000, clicksCount: 20, conversionRate: 4 / 20 }]);
  });

  it("detail() throws NOT_FOUND for a missing creator", async () => {
    prisma.creatorProfile.findUnique.mockResolvedValueOnce(null);
    await expect(service.detail("missing", baseQuery())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("detail() computes approval rate from CampaignApplication status groups", async () => {
    const result = await service.detail("creator1", baseQuery());
    expect(result.approvalRate).toBeCloseTo(3 / 4); // 3 approved / (3 approved + 1 rejected)
  });

  it("detail() reports viewsCount as an explicit null (not measurable), not omitted", async () => {
    const result = await service.detail("creator1", baseQuery());
    expect(result.viewsCount).toBeNull();
  });

  it("detail() computes referral stats from CreatorReferral/CreatorReferralReward", async () => {
    const result = await service.detail("creator1", baseQuery());
    expect(result.referralStats).toEqual({ totalReferred: 2, qualified: 1, totalRewardsMinor: 50_000 });
  });
});
