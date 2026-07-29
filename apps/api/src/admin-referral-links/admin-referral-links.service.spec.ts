import { Test } from "@nestjs/testing";
import { AdminReferralLinksService } from "./admin-referral-links.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

describe("AdminReferralLinksService", () => {
  let service: AdminReferralLinksService;
  let prisma: { referralLink: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock }; $queryRaw: jest.Mock };

  const link = {
    id: "link1",
    code: "malika-serum",
    creatorId: "creator1",
    campaignId: "campaign1",
    status: "ACTIVE" as const,
    creator: { displayName: "Malika" },
    campaign: { name: "Yoz kampaniyasi" },
    offer: { name: "Glow Serum" },
  };

  beforeEach(async () => {
    prisma = {
      referralLink: { findMany: jest.fn().mockResolvedValue([link]), findUnique: jest.fn(), update: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ linkId: "link1", clicks: 10n, orders: 2n, revenueMinor: 200_000n }]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AdminReferralLinksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AdminReferralLinksService);
  });

  it("merges link rows with their real click/order/revenue stats", async () => {
    const result = await service.list();
    expect(result).toEqual([
      {
        code: "malika-serum",
        creatorId: "creator1",
        creatorName: "Malika",
        campaignId: "campaign1",
        campaignName: "Yoz kampaniyasi",
        offerName: "Glow Serum",
        clicks: 10,
        orders: 2,
        revenueMinor: 200_000,
        status: "ACTIVE",
      },
    ]);
  });

  it("defaults a link with no stats row to all-zero, not undefined/NaN", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const [result] = await service.list();
    expect(result).toMatchObject({ clicks: 0, orders: 0, revenueMinor: 0 });
  });

  it("404s deactivating a link that doesn't exist", async () => {
    prisma.referralLink.findUnique.mockResolvedValue(null);
    await expect(service.deactivate("missing")).rejects.toThrow(DomainException);
  });

  it("sets status to PAUSED on deactivate", async () => {
    prisma.referralLink.findUnique.mockResolvedValue(link);
    prisma.referralLink.update.mockResolvedValue({ ...link, status: "PAUSED" });
    const result = await service.deactivate("malika-serum");
    expect(prisma.referralLink.update).toHaveBeenCalledWith(expect.objectContaining({ where: { code: "malika-serum" }, data: { status: "PAUSED" } }));
    expect(result.status).toBe("PAUSED");
  });
});
