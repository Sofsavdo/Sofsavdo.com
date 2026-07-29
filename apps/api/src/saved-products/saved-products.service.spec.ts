import { Test } from "@nestjs/testing";
import { SavedProductsService } from "./saved-products.service";
import { PrismaService } from "../prisma/prisma.service";

describe("SavedProductsService", () => {
  let service: SavedProductsService;
  let prisma: {
    savedProduct: { findMany: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    offer: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      savedProduct: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      offer: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SavedProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SavedProductsService);
  });

  describe("save", () => {
    it("throws NOT_FOUND when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.save("user1", "missing-offer")).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(prisma.savedProduct.upsert).not.toHaveBeenCalled();
    });

    it("upserts rather than plain-creates — saving an already-saved product is a no-op, not an error", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer1" });
      await service.save("user1", "offer1");
      expect(prisma.savedProduct.upsert).toHaveBeenCalledWith({
        where: { userId_offerId: { userId: "user1", offerId: "offer1" } },
        create: { userId: "user1", offerId: "offer1" },
        update: {},
      });
    });
  });

  describe("unsave", () => {
    it("is idempotent — deleteMany never errors even if nothing matched", async () => {
      prisma.savedProduct.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.unsave("user1", "offer1")).resolves.toBeUndefined();
      expect(prisma.savedProduct.deleteMany).toHaveBeenCalledWith({ where: { userId: "user1", offerId: "offer1" } });
    });
  });

  describe("list", () => {
    it("projects the offer's first product image, or null when there are none", async () => {
      prisma.savedProduct.findMany.mockResolvedValue([
        {
          offerId: "offer1",
          createdAt: new Date("2026-01-01"),
          offer: { id: "offer1", slug: "serum", name: "Serum", priceMinor: 50_000, currency: "UZS", product: { images: ["https://cdn.example.com/a.jpg"] } },
        },
        {
          offerId: "offer2",
          createdAt: new Date("2026-01-02"),
          offer: { id: "offer2", slug: "cream", name: "Cream", priceMinor: 30_000, currency: "UZS", product: { images: [] } },
        },
      ]);

      const result = await service.list("user1");

      expect(result[0]?.offer.imageUrl).toBe("https://cdn.example.com/a.jpg");
      expect(result[1]?.offer.imageUrl).toBeNull();
      expect(prisma.savedProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user1" } }),
      );
    });
  });
});
