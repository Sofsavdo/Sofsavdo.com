import { Test } from "@nestjs/testing";
import { AdminVisitorsService } from "./admin-visitors.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AdminVisitorsService", () => {
  let service: AdminVisitorsService;
  let prisma: { referralVisit: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { referralVisit: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [AdminVisitorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AdminVisitorsService);
  });

  it("reports source: null and attributedOrderToken: null for a visit with no Attribution yet, never a guessed default", async () => {
    prisma.referralVisit.findMany.mockResolvedValue([
      {
        id: "visit1",
        visitorId: "vis_abc",
        offer: { name: "Glow Serum" },
        campaign: null,
        referralLink: null,
        landingPage: "/o/glow-serum",
        createdAt: new Date("2026-01-01"),
        expiresAt: new Date("2026-01-31"),
        attributions: [],
      },
    ]);
    const [result] = await service.list();
    expect(result).toMatchObject({ source: null, attributedOrderToken: null, campaignName: null, creatorName: null });
  });

  it("always returns an empty fraudRiskFlags array — no fabricated fraud detection", async () => {
    prisma.referralVisit.findMany.mockResolvedValue([
      {
        id: "visit1",
        visitorId: "vis_abc",
        offer: { name: "Glow Serum" },
        campaign: { name: "Yoz kampaniyasi" },
        referralLink: { creator: { displayName: "Malika" } },
        landingPage: "/o/glow-serum",
        createdAt: new Date(),
        expiresAt: new Date(),
        attributions: [{ source: "PROMO_CODE", order: { publicToken: "pub-token-1" } }],
      },
    ]);
    const [result] = await service.list();
    expect(result?.fraudRiskFlags).toEqual([]);
    expect(result?.source).toBe("PROMO_CODE");
    expect(result?.attributedOrderToken).toBe("pub-token-1");
    expect(result?.creatorName).toBe("Malika");
  });
});
