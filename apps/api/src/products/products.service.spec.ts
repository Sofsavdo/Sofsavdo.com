import { Test } from "@nestjs/testing";
import { ProductsService } from "./products.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaginationQueryDto } from "../common/pagination/pagination.dto";

describe("ProductsService", () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  describe("list", () => {
    it("paginates and returns total count", async () => {
      prisma.product.findMany.mockResolvedValue([{ id: "p1" }]);
      prisma.product.count.mockResolvedValue(1);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20 });

      const result = await service.list(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it("builds a case-insensitive OR search over name, sku, and slug", async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20, search: "serum" });

      await service.list(query);

      const args = prisma.product.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { name: { contains: "serum", mode: "insensitive" } },
        { sku: { contains: "serum", mode: "insensitive" } },
        { slug: { contains: "serum", mode: "insensitive" } },
      ]);
    });

    it("ignores an unsortable sortBy field and falls back to createdAt desc", async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);
      const query = Object.assign(new PaginationQueryDto(), { page: 1, pageSize: 20, sortBy: "internalNotes" });

      await service.list(query);

      const args = prisma.product.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: "desc" });
    });
  });

  describe("findOneOrThrow", () => {
    it("throws a typed NOT_FOUND when the product doesn't exist", async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOneOrThrow("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns the product when found", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "p1", name: "Serum" });
      await expect(service.findOneOrThrow("p1")).resolves.toEqual({ id: "p1", name: "Serum" });
    });
  });

  describe("create", () => {
    it("throws SLUG_TAKEN when the slug already exists", async () => {
      prisma.product.findUnique.mockResolvedValueOnce({ id: "other", slug: "glow-serum" });
      await expect(
        service.create({ name: "X", slug: "glow-serum", type: "PHYSICAL_PRODUCT" } as any),
      ).rejects.toMatchObject({ code: "SLUG_TAKEN" });
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it("throws SKU_TAKEN when the sku already exists", async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(null) // slug check passes
        .mockResolvedValueOnce({ id: "other", sku: "RB-1" }); // sku check fails
      await expect(
        service.create({ name: "X", slug: "new-slug", type: "PHYSICAL_PRODUCT", sku: "RB-1" } as any),
      ).rejects.toMatchObject({ code: "SKU_TAKEN" });
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it("creates with defaults applied (images/videos default to [], currency defaults to UZS)", async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({ id: "new" });

      await service.create({ name: "Serum", slug: "serum", type: "PHYSICAL_PRODUCT" } as any);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ images: [], videos: [], currency: "UZS" }),
      });
    });
  });

  describe("update", () => {
    it("throws PRODUCT_ARCHIVED when editing content on an archived product without unarchiving", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "p1", status: "ARCHIVED", slug: "s", sku: null });
      await expect(service.update("p1", { name: "New name" } as any)).rejects.toMatchObject({
        code: "PRODUCT_ARCHIVED",
      });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it("allows unarchiving via status change", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "p1", status: "ARCHIVED", slug: "s", sku: null });
      prisma.product.update.mockResolvedValue({ id: "p1", status: "DRAFT" });

      await service.update("p1", { status: "DRAFT" } as any);

      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("re-checks slug uniqueness only when the slug actually changes", async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce({ id: "p1", status: "ACTIVE", slug: "old-slug", sku: null }) // findOneOrThrow
        .mockResolvedValueOnce(null); // slug availability check
      prisma.product.update.mockResolvedValue({ id: "p1" });

      await service.update("p1", { slug: "new-slug" });

      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { slug: "new-slug" } });
    });

    it("does not re-check slug uniqueness when the slug is unchanged", async () => {
      prisma.product.findUnique.mockResolvedValueOnce({ id: "p1", status: "ACTIVE", slug: "same-slug", sku: null });
      prisma.product.update.mockResolvedValue({ id: "p1" });

      await service.update("p1", { slug: "same-slug", name: "Renamed" });

      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("archive", () => {
    it("sets status to ARCHIVED", async () => {
      prisma.product.findUnique.mockResolvedValue({ id: "p1", status: "ACTIVE" });
      prisma.product.update.mockResolvedValue({ id: "p1", status: "ARCHIVED" });

      const result = await service.archive("p1");

      expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { status: "ARCHIVED" } });
      expect(result.status).toBe("ARCHIVED");
    });

    it("throws NOT_FOUND when archiving a nonexistent product", async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.archive("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
