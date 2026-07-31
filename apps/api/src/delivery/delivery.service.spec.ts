import { Test } from "@nestjs/testing";
import { DeliveryService } from "./delivery.service";
import { PrismaService } from "../prisma/prisma.service";

describe("DeliveryService", () => {
  let service: DeliveryService;
  let prisma: {
    offer: { findUnique: jest.Mock };
    offerDeliveryRegion: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; createMany: jest.Mock; update: jest.Mock; delete: jest.Mock; findMany: jest.Mock };
  };

  const physicalOffer = { id: "offer1", priceMinor: 299_000_00, currency: "UZS", slug: "physical-offer", product: { type: "PHYSICAL_PRODUCT" } };
  const digitalOffer = { id: "offer2", priceMinor: 100_000_00, currency: "UZS", slug: "digital-offer", product: { type: "DIGITAL_PRODUCT" } };

  beforeEach(async () => {
    prisma = {
      offer: { findUnique: jest.fn() },
      offerDeliveryRegion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DeliveryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DeliveryService);
  });

  describe("create", () => {
    it("rejects a delivery region for a non-physical product with PRODUCT_NOT_PHYSICAL", async () => {
      prisma.offer.findUnique.mockResolvedValue(digitalOffer);
      await expect(
        service.create("offer2", { regionCode: "TAS", regionName: "Toshkent", feeType: "FREE" }),
      ).rejects.toMatchObject({ code: "PRODUCT_NOT_PHYSICAL" });
    });

    it("accepts a FREE region with zero fee for a physical product", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue(null);
      prisma.offerDeliveryRegion.findFirst.mockResolvedValue(null);
      prisma.offerDeliveryRegion.create.mockResolvedValue({ id: "region1" });
      await service.create("offer1", { regionCode: "TAS", regionName: "Toshkent", feeType: "FREE" });
      expect(prisma.offerDeliveryRegion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deliveryFeeMinor: 0 }) }),
      );
    });

    it("rejects a FIXED region with a zero/missing fee with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue(null);
      await expect(
        service.create("offer1", { regionCode: "AND", regionName: "Andijon", feeType: "FIXED" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("accepts a FIXED region with a positive fee", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue(null);
      prisma.offerDeliveryRegion.findFirst.mockResolvedValue(null);
      prisma.offerDeliveryRegion.create.mockResolvedValue({ id: "region2" });
      await service.create("offer1", { regionCode: "AND", regionName: "Andijon", feeType: "FIXED", deliveryFeeMinor: 25_000_00 });
      expect(prisma.offerDeliveryRegion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deliveryFeeMinor: 25_000_00 }) }),
      );
    });

    it("rejects estimatedMinDays greater than estimatedMaxDays with VALIDATION_ERROR", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue(null);
      await expect(
        service.create("offer1", { regionCode: "AND", regionName: "Andijon", feeType: "FREE", estimatedMinDays: 5, estimatedMaxDays: 2 }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects a duplicate offerId+regionCode with CONFLICT", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue({ id: "existing" });
      await expect(
        service.create("offer1", { regionCode: "TAS", regionName: "Toshkent", feeType: "FREE" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("quote", () => {
    it("returns priceMinor-only total for a non-physical offer, regionRequired=false", async () => {
      prisma.offer.findUnique.mockResolvedValue(digitalOffer);
      const result = await service.quote("digital-offer", undefined);
      expect(result).toMatchObject({ priceMinor: digitalOffer.priceMinor, deliveryFeeMinor: 0, totalMinor: digitalOffer.priceMinor, regionRequired: false });
    });

    it("throws REGION_REQUIRED for a physical offer with no regionCode given", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      await expect(service.quote("physical-offer", undefined)).rejects.toMatchObject({ code: "REGION_REQUIRED" });
    });

    it("computes price + free delivery = price for a FREE region", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue({
        regionCode: "TAS",
        regionName: "Toshkent",
        active: true,
        availability: "AVAILABLE",
        feeType: "FREE",
        deliveryFeeMinor: 0,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
      });
      const result = await service.quote("physical-offer", "TAS");
      expect(result.totalMinor).toBe(physicalOffer.priceMinor);
      expect(result.deliveryFeeMinor).toBe(0);
    });

    it("computes price + fixed delivery fee for a FIXED region", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue({
        regionCode: "AND",
        regionName: "Andijon",
        active: true,
        availability: "AVAILABLE",
        feeType: "FIXED",
        deliveryFeeMinor: 25_000_00,
        estimatedMinDays: 3,
        estimatedMaxDays: 5,
      });
      const result = await service.quote("physical-offer", "AND");
      expect(result.totalMinor).toBe(physicalOffer.priceMinor + 25_000_00);
      expect(result.deliveryFeeMinor).toBe(25_000_00);
    });

    it("throws DELIVERY_REGION_NOT_FOUND for an unknown region", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue(null);
      await expect(service.quote("physical-offer", "XXX")).rejects.toMatchObject({ code: "DELIVERY_REGION_NOT_FOUND" });
    });

    it("throws DELIVERY_REGION_UNAVAILABLE for an inactive-availability region", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.findUnique.mockResolvedValue({
        regionCode: "REMOTE",
        regionName: "Uzoq hudud",
        active: true,
        availability: "UNAVAILABLE",
        feeType: "FIXED",
        deliveryFeeMinor: 50_000_00,
      });
      await expect(service.quote("physical-offer", "REMOTE")).rejects.toMatchObject({ code: "DELIVERY_REGION_UNAVAILABLE" });
    });

    it("never creates an Order — quote() only ever reads", async () => {
      prisma.offer.findUnique.mockResolvedValue(digitalOffer);
      await service.quote("digital-offer", undefined);
      expect(Object.keys(prisma)).not.toContain("order");
    });
  });

  describe("seedStandardRegions", () => {
    it("rejects for a non-physical product with PRODUCT_NOT_PHYSICAL", async () => {
      prisma.offer.findUnique.mockResolvedValue(digitalOffer);
      await expect(service.seedStandardRegions("offer2")).rejects.toMatchObject({ code: "PRODUCT_NOT_PHYSICAL" });
      expect(prisma.offerDeliveryRegion.createMany).not.toHaveBeenCalled();
    });

    it("bulk-creates every canonical zone in one call, skipping ones that already exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.createMany.mockResolvedValue({ count: 190 });
      prisma.offerDeliveryRegion.findMany.mockResolvedValue([]);

      await service.seedStandardRegions("offer1");

      expect(prisma.offerDeliveryRegion.createMany).toHaveBeenCalledTimes(1);
      const call = prisma.offerDeliveryRegion.createMany.mock.calls[0][0];
      expect(call.skipDuplicates).toBe(true);
      expect(call.data.length).toBeGreaterThan(100);
      expect(call.data.every((row: { offerId: string }) => row.offerId === "offer1")).toBe(true);
    });

    it("prices Toshkent shahar free, regional centers and districts at their standard tiers", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.createMany.mockResolvedValue({ count: 190 });
      prisma.offerDeliveryRegion.findMany.mockResolvedValue([]);

      await service.seedStandardRegions("offer1");

      const rows = prisma.offerDeliveryRegion.createMany.mock.calls[0][0].data as Array<{
        regionCode: string;
        feeType: string;
        deliveryFeeMinor: number;
      }>;
      const tashkentCity = rows.find((r) => r.regionCode === "toshkent-shahar:free")!;
      expect(tashkentCity).toMatchObject({ feeType: "FREE", deliveryFeeMinor: 0 });

      const regionalCenters = rows.filter((r) => r.regionCode.endsWith(":markaz"));
      expect(regionalCenters.length).toBeGreaterThanOrEqual(13); // 12 viloyat + Qoraqalpog'iston, excluding Toshkent shahar
      expect(regionalCenters.every((r) => r.feeType === "FIXED" && r.deliveryFeeMinor === 35_000_00)).toBe(true);

      const districts = rows.filter((r) => !r.regionCode.endsWith(":markaz") && r.regionCode !== "toshkent-shahar:free");
      expect(districts.length).toBeGreaterThan(150);
      expect(districts.every((r) => r.feeType === "FIXED" && r.deliveryFeeMinor === 45_000_00)).toBe(true);
    });

    it("is idempotent — calling it twice never errors on the unique (offerId, regionCode) constraint", async () => {
      prisma.offer.findUnique.mockResolvedValue(physicalOffer);
      prisma.offerDeliveryRegion.createMany.mockResolvedValue({ count: 190 });
      prisma.offerDeliveryRegion.findMany.mockResolvedValue([]);

      await service.seedStandardRegions("offer1");
      await expect(service.seedStandardRegions("offer1")).resolves.not.toThrow();
      expect(prisma.offerDeliveryRegion.createMany).toHaveBeenCalledTimes(2);
    });
  });
});
