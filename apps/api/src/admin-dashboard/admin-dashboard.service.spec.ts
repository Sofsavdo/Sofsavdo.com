import { Test } from "@nestjs/testing";
import { AdminDashboardService } from "./admin-dashboard.service";
import { PrismaService } from "../prisma/prisma.service";
import { ExecutiveAnalyticsService } from "../analytics/executive-analytics.service";
import { CreatorAnalyticsService } from "../analytics/creator-analytics.service";
import { ProductAnalyticsService } from "../analytics/product-analytics.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";

describe("AdminDashboardService", () => {
  let service: AdminDashboardService;
  let prisma: {
    commission: { aggregate: jest.Mock };
    payout: { aggregate: jest.Mock; count: jest.Mock };
    refund: { count: jest.Mock };
    creatorApplication: { count: jest.Mock };
    order: { aggregate: jest.Mock };
    referralVisit: { count: jest.Mock };
  };
  let executive: { getSummary: jest.Mock };
  let creatorAnalytics: { list: jest.Mock };
  let productAnalytics: { list: jest.Mock };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };

  const metrics = (overrides: Partial<Record<string, number>> = {}) => ({
    gmvMinor: 0,
    revenueMinor: 1_000_000,
    netRevenueMinor: 900_000,
    ordersCount: 10,
    paidOrdersCount: 8,
    pendingOrdersCount: 2,
    refundsMinor: 0,
    refundRate: 0.05,
    activeCreatorsCount: 3,
    activeCampaignsCount: 4,
    creatorLinkConversionRate: 0.12,
    averageOrderValueMinor: 100_000,
    newCustomers: 5,
    returningCustomers: 2,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      commission: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: 50_000 } }) },
      payout: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: 30_000 } }), count: jest.fn().mockResolvedValue(0) },
      refund: { count: jest.fn().mockResolvedValue(0) },
      creatorApplication: { count: jest.fn().mockResolvedValue(0) },
      order: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalMinor: 100_000 } }) },
      referralVisit: { count: jest.fn().mockResolvedValue(40) },
    };
    executive = { getSummary: jest.fn().mockResolvedValue({ current: metrics(), trend: [] }) };
    creatorAnalytics = { list: jest.fn().mockResolvedValue({ items: [{ creatorId: "c1", displayName: "Top Creator", revenueMinor: 500_000, ordersCount: 5, clicksCount: 10, conversionRate: 0.5 }] }) };
    productAnalytics = { list: jest.fn().mockResolvedValue({ items: [{ productId: "p1", name: "Top Product", ordersCount: 5, revenueMinor: 400_000, refundsMinor: 0, averageOrderValueMinor: 80_000 }] }) };
    cache = { buildKey: jest.fn().mockReturnValue("dash-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExecutiveAnalyticsService, useValue: executive },
        { provide: CreatorAnalyticsService, useValue: creatorAnalytics },
        { provide: ProductAnalyticsService, useValue: productAnalytics },
        { provide: AnalyticsCacheService, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(AdminDashboardService);
  });

  it("returns the cached summary without recomputing when present", async () => {
    const cached = { todayRevenueMinor: 1 } as never;
    cache.get.mockResolvedValue(cached);
    const result = await service.getSummary();
    expect(result).toBe(cached);
    expect(executive.getSummary).not.toHaveBeenCalled();
  });

  it("composes today/month executive metrics, commission liability, and pending payouts from real aggregates", async () => {
    const result = await service.getSummary();
    expect(result.monthlyRevenueMinor).toBe(1_000_000);
    expect(result.netRevenueMinor).toBe(900_000);
    expect(result.paidOrders).toBe(8);
    expect(result.commissionLiabilityMinor).toBe(50_000);
    expect(result.pendingPayoutsMinor).toBe(30_000);
  });

  it("scopes commission liability to PENDING/APPROVED/PAYABLE only", async () => {
    await service.getSummary();
    expect(prisma.commission.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["PENDING", "APPROVED", "PAYABLE"] } } }),
    );
  });

  it("maps top offers/creators from the real ProductAnalytics/CreatorAnalytics services, not fabricated data", async () => {
    const result = await service.getSummary();
    expect(result.topOffers).toEqual([{ name: "Top Product", revenueMinor: 400_000 }]);
    expect(result.topCreators).toEqual([{ name: "Top Creator", revenueMinor: 500_000 }]);
  });

  it("builds the funnel from only the 3 real trackable stages (clicks/orders/paidOrders), never fabricating landing-view/checkout-start numbers", async () => {
    const result = await service.getSummary();
    expect(result.funnel).toEqual({ clicks: 40, orders: 10, paidOrders: 8 });
  });

  it("produces a real task for each nonzero pending count, and omits it when zero", async () => {
    prisma.payout.count.mockResolvedValue(3);
    prisma.refund.count.mockResolvedValue(0);
    prisma.creatorApplication.count.mockResolvedValue(2);
    const result = await service.getSummary();
    expect(result.tasks).toEqual([
      { text: "3 ta payout so'rovi ko'rib chiqilishi kerak", href: "/admin/payouts" },
      { text: "2 ta creator arizasi kutilmoqda", href: "/admin/creator-applications" },
    ]);
  });

  it("caches the freshly-computed summary with a 60s TTL", async () => {
    await service.getSummary();
    expect(cache.set).toHaveBeenCalledWith("dash-key", expect.any(Object), 60);
  });
});
