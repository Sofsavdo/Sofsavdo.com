import { Test } from "@nestjs/testing";
import { OffersService, FEATURED_OFFERS_LIMIT, CATALOG_MAX_PAGE_SIZE } from "./offers.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/pagination/pagination.dto";
import { CatalogQueryDto } from "./dto/catalog-query.dto";

describe("OffersService", () => {
  let service: OffersService;
  let prisma: {
    offer: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    product: { findUnique: jest.Mock };
    offerVariant: { createMany: jest.Mock; deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const baseOffer = {
    id: "offer1",
    productId: "prod1",
    status: "DRAFT" as const,
    priceMinor: 10_000,
    compareAtPriceMinor: null,
    startsAt: null,
    expiresAt: null,
    archivedAt: null,
    slug: "existing-slug",
    product: { id: "prod1", name: "Product", slug: "product", sku: "SKU-1", status: "ACTIVE" },
  };

  beforeEach(async () => {
    prisma = {
      offer: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      product: { findUnique: jest.fn() },
      offerVariant: { createMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [OffersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OffersService);
  });

  describe("computeAvailability", () => {
    const now = new Date("2026-06-15T00:00:00Z");

    it("is INACTIVE for any non-ACTIVE stored status, regardless of dates", () => {
      for (const status of ["DRAFT", "PAUSED", "ARCHIVED"] as const) {
        expect(service.computeAvailability({ status, startsAt: null, expiresAt: null }, now)).toBe("INACTIVE");
      }
    });

    it("is LIVE when ACTIVE with no date bounds", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startsAt: null, expiresAt: null }, now)).toBe("LIVE");
    });

    it("is SCHEDULED when ACTIVE but startsAt is in the future", () => {
      const startsAt = new Date("2026-07-01T00:00:00Z");
      expect(service.computeAvailability({ status: "ACTIVE", startsAt, expiresAt: null }, now)).toBe("SCHEDULED");
    });

    it("is EXPIRED when ACTIVE but expiresAt has passed — without ever touching stored status", () => {
      const expiresAt = new Date("2026-06-01T00:00:00Z");
      expect(service.computeAvailability({ status: "ACTIVE", startsAt: null, expiresAt }, now)).toBe("EXPIRED");
    });

    it("boundary: startsAt exactly equal to now is LIVE, not SCHEDULED (> not >=)", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startsAt: now, expiresAt: null }, now)).toBe("LIVE");
    });

    it("boundary: expiresAt exactly equal to now is LIVE, not EXPIRED (< not <=)", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startsAt: null, expiresAt: now }, now)).toBe("LIVE");
    });
  });

  describe("create", () => {
    it("throws NOT_FOUND when the product doesn't exist", async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ productId: "missing", name: "X", slug: "x", headline: "h", priceMinor: 1000 } as any, null),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws SLUG_TAKEN when the slug already exists", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.findUnique.mockResolvedValueOnce({ id: "other", slug: "taken" });
      await expect(
        service.create({ productId: "prod1", name: "X", slug: "taken", headline: "h", priceMinor: 1000 } as any, null),
      ).rejects.toMatchObject({ code: "SLUG_TAKEN" });
    });

    it("throws VALIDATION_ERROR when compareAtPriceMinor is less than priceMinor (sale price exceeds original)", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create(
          { productId: "prod1", name: "X", slug: "x", headline: "h", priceMinor: 10_000, compareAtPriceMinor: 5_000 } as any,
          null,
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("allows compareAtPriceMinor exactly equal to priceMinor (zero implied discount, not an error)", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.findUnique.mockResolvedValueOnce(null);
      prisma.offer.create.mockResolvedValue({ id: "new1" });
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, id: "new1", priceMinor: 10_000, compareAtPriceMinor: 10_000 });
      await expect(
        service.create(
          { productId: "prod1", name: "X", slug: "x", headline: "h", priceMinor: 10_000, compareAtPriceMinor: 10_000 } as any,
          null,
        ),
      ).resolves.toMatchObject({ impliedDiscountBasisPoints: 0 });
    });

    it("throws VALIDATION_ERROR when startsAt is not before expiresAt", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create(
          {
            productId: "prod1",
            name: "X",
            slug: "x",
            headline: "h",
            priceMinor: 1000,
            startsAt: "2026-08-01T00:00:00Z",
            expiresAt: "2026-07-01T00:00:00Z",
          } as any,
          null,
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("creates the offer and its variants inside one transaction", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.findUnique.mockResolvedValueOnce(null);
      prisma.offer.create.mockResolvedValue({ id: "new1" });
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, id: "new1" });

      await service.create(
        {
          productId: "prod1",
          name: "X",
          slug: "x",
          headline: "h",
          priceMinor: 1000,
          variants: [{ name: "Standard", priceMinor: 1000 }],
        },
        "actor1",
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.offerVariant.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ offerId: "new1", name: "Standard", isDefault: true, sortOrder: 0 })],
      });
    });
  });

  describe("update", () => {
    it("throws OFFER_ARCHIVED when editing an archived offer's content", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...baseOffer, status: "ARCHIVED" });
      await expect(service.update("offer1", { name: "New" } as any, null)).rejects.toMatchObject({
        code: "OFFER_ARCHIVED",
      });
    });

    it("re-validates pricing against the MERGED result, not just the changed field", async () => {
      // existing priceMinor 10_000 with no compareAtPriceMinor; patch only sets compareAtPriceMinor
      // lower than the existing price — must still be caught even though priceMinor itself wasn't
      // part of this patch.
      prisma.offer.findUnique.mockResolvedValue({ ...baseOffer, priceMinor: 10_000, compareAtPriceMinor: null });
      await expect(
        service.update("offer1", { compareAtPriceMinor: 5_000 } as any, null),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("status transitions", () => {
    it.each([
      ["DRAFT", "ACTIVE"],
      ["DRAFT", "ARCHIVED"],
      ["ACTIVE", "PAUSED"],
      ["ACTIVE", "ARCHIVED"],
      ["PAUSED", "ACTIVE"],
      ["PAUSED", "ARCHIVED"],
    ])("allows %s -> %s", async (from, to) => {
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, status: from });
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ACTIVE" });
      prisma.offer.update.mockResolvedValue({});
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, status: to });

      const action = to === "ACTIVE" ? service.activate.bind(service) : to === "PAUSED" ? service.pause.bind(service) : service.archive.bind(service);
      await expect(action("offer1", null)).resolves.toBeDefined();
    });

    it.each([
      ["DRAFT", "PAUSED"],
      ["PAUSED", "PAUSED"],
      ["ARCHIVED", "ACTIVE"],
      ["ARCHIVED", "PAUSED"],
      ["ARCHIVED", "ARCHIVED"],
    ])("forbids %s -> %s with a typed INVALID_OFFER_TRANSITION", async (from, to) => {
      prisma.offer.findUnique.mockResolvedValue({ ...baseOffer, status: from });
      const action = to === "ACTIVE" ? service.activate.bind(service) : to === "PAUSED" ? service.pause.bind(service) : service.archive.bind(service);
      await expect(action("offer1", null)).rejects.toMatchObject({ code: "INVALID_OFFER_TRANSITION" });
    });

    it("blocks activation when the parent Product is archived (PRODUCT_NOT_ELIGIBLE)", async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...baseOffer, status: "DRAFT" });
      prisma.product.findUnique.mockResolvedValue({ id: "prod1", status: "ARCHIVED" });
      await expect(service.activate("offer1", null)).rejects.toMatchObject({ code: "PRODUCT_NOT_ELIGIBLE" });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it("sets archivedAt when archiving, and never clears it once set", async () => {
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, status: "ACTIVE" });
      prisma.offer.update.mockResolvedValue({});
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, status: "ARCHIVED", archivedAt: new Date() });

      await service.archive("offer1", "actor1");

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: "offer1" },
        data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date), updatedById: "actor1" }),
      });
    });

    it("throws NOT_FOUND when transitioning a nonexistent offer", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.activate("missing", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("list", () => {
    it("builds a search OR across offer name/slug and product name/sku", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20, search: "serum" });

      await service.list(query);

      const args = prisma.offer.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { name: { contains: "serum", mode: "insensitive" } },
        { slug: { contains: "serum", mode: "insensitive" } },
        { product: { name: { contains: "serum", mode: "insensitive" } } },
        { product: { sku: { contains: "serum", mode: "insensitive" } } },
      ]);
    });

    it("selects only summary fields from Product (no N+1, no over-fetching)", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20 });

      await service.list(query);

      const args = prisma.offer.findMany.mock.calls[0][0];
      expect(args.include).toEqual({
        product: { select: { id: true, name: true, slug: true, sku: true, status: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      });
    });

    it("filters by archived=true using archivedAt IS NOT NULL", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20, archived: true });

      await service.list(query);

      expect(prisma.offer.findMany.mock.calls[0][0].where.archivedAt).toEqual({ not: null });
    });
  });

  describe("listFeaturedPublic", () => {
    const featuredOffer = {
      id: "offer1",
      slug: "test-offer",
      name: "Test Offer",
      headline: "Headline",
      priceMinor: 100_000,
      compareAtPriceMinor: null,
      currency: "UZS",
      product: { images: ["https://cdn.example.com/a.jpg"] },
    };

    it("always caps the query at FEATURED_OFFERS_LIMIT, never a caller-supplied value", async () => {
      prisma.offer.findMany.mockResolvedValue([featuredOffer]);
      await service.listFeaturedPublic();
      expect(prisma.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: FEATURED_OFFERS_LIMIT }));
    });

    it("filters to isFeatured + ACTIVE only — never DRAFT/PAUSED/ARCHIVED", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      await service.listFeaturedPublic();
      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isFeatured: true, status: "ACTIVE" }) }),
      );
    });

    it("returns a public-safe projection with the product's first image", async () => {
      prisma.offer.findMany.mockResolvedValue([featuredOffer]);
      const result = await service.listFeaturedPublic();
      expect(result).toEqual([
        {
          id: "offer1",
          slug: "test-offer",
          name: "Test Offer",
          headline: "Headline",
          priceMinor: 100_000,
          compareAtPriceMinor: null,
          currency: "UZS",
          imageUrl: "https://cdn.example.com/a.jpg",
        },
      ]);
    });

    it("returns null imageUrl when the product has no images", async () => {
      prisma.offer.findMany.mockResolvedValue([{ ...featuredOffer, product: { images: [] } }]);
      const result = await service.listFeaturedPublic();
      expect(result[0]?.imageUrl).toBeNull();
    });
  });

  describe("feature / unfeature", () => {
    it("throws NOT_FOUND when the offer doesn't exist", async () => {
      prisma.offer.findUnique.mockResolvedValue(null);
      await expect(service.feature("missing", "actor1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("sets isFeatured to true regardless of the offer's current status", async () => {
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer }).mockResolvedValueOnce({ ...baseOffer, isFeatured: true });
      await service.feature("offer1", "actor1");
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: "offer1" },
        data: { isFeatured: true, updatedById: "actor1" },
      });
    });

    it("sets isFeatured to false on unfeature", async () => {
      prisma.offer.findUnique.mockResolvedValueOnce({ ...baseOffer, isFeatured: true }).mockResolvedValueOnce({ ...baseOffer, isFeatured: false });
      await service.unfeature("offer1", "actor1");
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: "offer1" },
        data: { isFeatured: false, updatedById: "actor1" },
      });
    });
  });

  describe("listCatalog (Phase E)", () => {
    const catalogOffer = {
      id: "offer1",
      slug: "serum",
      name: "Serum",
      headline: "Headline",
      priceMinor: 100_000,
      compareAtPriceMinor: null,
      currency: "UZS",
      product: { images: ["https://cdn.example.com/a.jpg"], type: "PHYSICAL_PRODUCT" },
    };

    it("never returns more than CATALOG_MAX_PAGE_SIZE, even when the client requests more", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new CatalogQueryDto(), { page: 1, pageSize: 100 });

      await service.listCatalog(query);

      expect(prisma.offer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: CATALOG_MAX_PAGE_SIZE }));
    });

    it("filters to ACTIVE offers on non-archived products only — never DRAFT/PAUSED/ARCHIVED", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new CatalogQueryDto(), { page: 1, pageSize: 20 });

      await service.listCatalog(query);

      const args = prisma.offer.findMany.mock.calls[0][0];
      expect(args.where.status).toBe("ACTIVE");
      expect(args.where.product.status).toEqual({ not: "ARCHIVED" });
    });

    it("applies a product-type filter when given", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new CatalogQueryDto(), { page: 1, pageSize: 20, type: "COURSE" });

      await service.listCatalog(query);

      expect(prisma.offer.findMany.mock.calls[0][0].where.product.type).toBe("COURSE");
    });

    it("applies a min/max price range filter when given", async () => {
      prisma.offer.findMany.mockResolvedValue([]);
      prisma.offer.count.mockResolvedValue(0);
      const query = Object.assign(new CatalogQueryDto(), { page: 1, pageSize: 20, minPriceMinor: 10_000, maxPriceMinor: 50_000 });

      await service.listCatalog(query);

      expect(prisma.offer.findMany.mock.calls[0][0].where.priceMinor).toEqual({ gte: 10_000, lte: 50_000 });
    });

    it("has no search field on the query DTO at all (docs/PROHIBITED.md still bans public search)", () => {
      expect("search" in new CatalogQueryDto()).toBe(false);
    });

    it("returns the public-safe projection with product type and first image", async () => {
      prisma.offer.findMany.mockResolvedValue([catalogOffer]);
      prisma.offer.count.mockResolvedValue(1);
      const query = Object.assign(new CatalogQueryDto(), { page: 1, pageSize: 20 });

      const result = await service.listCatalog(query);

      expect(result.items).toEqual([
        {
          id: "offer1",
          slug: "serum",
          name: "Serum",
          headline: "Headline",
          priceMinor: 100_000,
          compareAtPriceMinor: null,
          currency: "UZS",
          imageUrl: "https://cdn.example.com/a.jpg",
          productType: "PHYSICAL_PRODUCT",
        },
      ]);
      expect(result.total).toBe(1);
    });
  });
});
