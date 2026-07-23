import { Test } from "@nestjs/testing";
import { PromoCodesService } from "./promo-codes.service";
import { PrismaService } from "../prisma/prisma.service";

describe("PromoCodesService", () => {
  let service: PromoCodesService;
  let prisma: { offer: { findUnique: jest.Mock }; promoCode: { findUnique: jest.Mock } };
  let tx: { promoCode: { findUnique: jest.Mock; update: jest.Mock }; promoCodeUsage: { count: jest.Mock; create: jest.Mock } };

  const basePromo = {
    id: "promo1",
    code: "MALIKA10",
    offerId: "offer1",
    campaignId: "campaign1",
    creatorId: "creator1",
    discountType: "PERCENTAGE" as const,
    discountValue: 1000, // 10% in basis points
    minimumOrderAmount: null,
    usageLimit: null,
    perCustomerLimit: null,
    usageCount: 0,
    startsAt: new Date("2020-01-01"),
    expiresAt: null,
    isActive: true,
  };

  beforeEach(async () => {
    prisma = { offer: { findUnique: jest.fn() }, promoCode: { findUnique: jest.fn() } };
    tx = { promoCode: { findUnique: jest.fn(), update: jest.fn() }, promoCodeUsage: { count: jest.fn(), create: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [PromoCodesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PromoCodesService);
  });

  describe("validate", () => {
    it("computes a percentage discount against the given base amount", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue(basePromo);
      const result = await service.validate("offer-slug", "malika10", 100_000_00);
      expect(result.discountMinor).toBe(10_000_00);
    });

    it("clamps a fixed-amount discount to never exceed the base amount", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, discountType: "FIXED_AMOUNT", discountValue: 500_000_00 });
      const result = await service.validate("offer-slug", "MALIKA10", 100_000_00);
      expect(result.discountMinor).toBe(100_000_00);
    });

    it("throws PROMO_NOT_FOUND when the code doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue(null);
      await expect(service.validate("offer-slug", "NOPE", 1000)).rejects.toMatchObject({ code: "PROMO_NOT_FOUND" });
    });

    it("throws PROMO_NOT_FOUND when the code belongs to a different offer (no id-guessing oracle)", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-other" });
      prisma.promoCode.findUnique.mockResolvedValue(basePromo);
      await expect(service.validate("other-slug", "MALIKA10", 1000)).rejects.toMatchObject({ code: "PROMO_NOT_FOUND" });
    });

    it("throws PROMO_INACTIVE for a deactivated code", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, isActive: false });
      await expect(service.validate("offer-slug", "MALIKA10", 1000)).rejects.toMatchObject({ code: "PROMO_INACTIVE" });
    });

    it("throws PROMO_NOT_STARTED before startsAt", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, startsAt: new Date("2099-01-01") });
      await expect(service.validate("offer-slug", "MALIKA10", 1000)).rejects.toMatchObject({ code: "PROMO_NOT_STARTED" });
    });

    it("throws PROMO_EXPIRED after expiresAt", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, expiresAt: new Date("2020-06-01") });
      await expect(service.validate("offer-slug", "MALIKA10", 1000)).rejects.toMatchObject({ code: "PROMO_EXPIRED" });
    });

    it("throws PROMO_USAGE_LIMIT once usageCount reaches usageLimit", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, usageLimit: 5, usageCount: 5 });
      await expect(service.validate("offer-slug", "MALIKA10", 1000)).rejects.toMatchObject({ code: "PROMO_USAGE_LIMIT" });
    });

    it("throws PROMO_MINIMUM_NOT_REACHED when the base amount is too small", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue({ ...basePromo, minimumOrderAmount: 200_000_00 });
      await expect(service.validate("offer-slug", "MALIKA10", 100_000_00)).rejects.toMatchObject({ code: "PROMO_MINIMUM_NOT_REACHED" });
    });

    it("never mutates usageCount or creates a usage row — read-only preview", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      prisma.promoCode.findUnique.mockResolvedValue(basePromo);
      await service.validate("offer-slug", "MALIKA10", 100_000_00);
      expect(Object.keys(prisma)).not.toContain("promoCodeUsage");
    });
  });

  describe("findAndAssertUsable + commitUsage (redemption)", () => {
    it("enforces perCustomerLimit only when a customerId is supplied", async () => {
      tx.promoCode.findUnique.mockResolvedValue({ ...basePromo, perCustomerLimit: 1 });
      tx.promoCodeUsage.count.mockResolvedValue(1);
      await expect(
        service.findAndAssertUsable(tx as never, "offer1", "MALIKA10", 100_000_00, "customer1"),
      ).rejects.toMatchObject({ code: "PROMO_CUSTOMER_LIMIT" });
    });

    it("commits usage by incrementing usageCount and creating a PromoCodeUsage row", async () => {
      await service.commitUsage(tx as never, "promo1", "order1", "customer1");
      expect(tx.promoCode.update).toHaveBeenCalledWith({ where: { id: "promo1" }, data: { usageCount: { increment: 1 } } });
      expect(tx.promoCodeUsage.create).toHaveBeenCalledWith({ data: { promoCodeId: "promo1", orderId: "order1", customerId: "customer1" } });
    });
  });
});
