import { Injectable } from "@nestjs/common";
import type { Prisma, Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { ProductQueryDto } from "./dto/product-query.dto";

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(query: ProductQueryDto): Promise<PaginatedResult<Product>> {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      type: query.type,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { sku: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["name", "createdAt", "updatedAt", "status"]);
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy)
        ? { [query.sortBy]: query.sortDir ?? "desc" }
        : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy, skip: query.skip, take: query.take }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async listByCreator(creatorProfileId: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { creatorProfileId: creatorProfileId },
          { creatorProfileId: null, status: 'ACTIVE' },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        shortDescription: true,
        description: true,
        brand: true,
        sku: true,
        status: true,
        images: true,
        videos: true,
        attributes: true,
        costPriceMinor: true,
        currency: true,
        internalNotes: true,
        stockQuantity: true,
        creatorProfileId: true,
        createdAt: true,
        updatedAt: true,
        priceMinor: true,
        commissionType: true,
        commissionRateBps: true,
        commissionAmountMinor: true,
      },
    });
  }

  async listAvailableForPromotion(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        status: "ACTIVE",
        offers: {
          some: {
            status: "ACTIVE",
          },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        shortDescription: true,
        description: true,
        brand: true,
        sku: true,
        status: true,
        images: true,
        videos: true,
        attributes: true,
        costPriceMinor: true,
        currency: true,
        internalNotes: true,
        stockQuantity: true,
        creatorProfileId: true,
        createdAt: true,
        updatedAt: true,
        priceMinor: true,
        commissionType: true,
        commissionRateBps: true,
        commissionAmountMinor: true,
        offers: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            slug: true,
            priceMinor: true,
            compareAtPriceMinor: true,
            currency: true,
            status: true,
            campaigns: {
              select: {
                id: true,
                name: true,
                referralLinks: {
                  select: {
                    id: true,
                    code: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOneOrThrow(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new DomainException("NOT_FOUND", "Mahsulot topilmadi.");
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertSlugAndSkuAvailable(dto.slug, dto.sku);
    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        shortDescription: dto.shortDescription,
        description: dto.description,
        brand: dto.brand,
        sku: dto.sku,
        images: dto.images ?? [],
        videos: dto.videos ?? [],
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
        costPriceMinor: dto.costPriceMinor,
        currency: dto.currency ?? "UZS",
        internalNotes: dto.internalNotes,
        creatorProfileId: dto.creatorProfileId,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.findOneOrThrow(id);
    if (existing.status === "ARCHIVED" && dto.status !== "ACTIVE" && dto.status !== "DRAFT") {
      // Archived products are historical/read-mostly (real Offers may still reference them) —
      // editing content on an archived product is blocked to avoid silently rewriting history
      // an Offer snapshot elsewhere might assume is stable; unarchiving (status -> DRAFT/ACTIVE)
      // is the only allowed transition out of this state.
      throw new DomainException("PRODUCT_ARCHIVED", "Arxivlangan mahsulotni tahrirlab bo'lmaydi — avval qayta faollashtiring.");
    }
    if (dto.slug && dto.slug !== existing.slug) await this.assertSlugAndSkuAvailable(dto.slug, undefined, id);
    if (dto.sku && dto.sku !== existing.sku) await this.assertSlugAndSkuAvailable(undefined, dto.sku, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        shortDescription: dto.shortDescription,
        description: dto.description,
        brand: dto.brand,
        sku: dto.sku,
        images: dto.images,
        videos: dto.videos,
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
        costPriceMinor: dto.costPriceMinor,
        currency: dto.currency,
        internalNotes: dto.internalNotes,
        status: dto.status,
        creatorProfileId: dto.creatorProfileId,
      },
    });
  }

  async archive(id: string): Promise<Product> {
    await this.findOneOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  private async assertSlugAndSkuAvailable(slug?: string, sku?: string, excludeId?: string): Promise<void> {
    if (slug) {
      const bySlug = await this.prisma.product.findUnique({ where: { slug } });
      if (bySlug && bySlug.id !== excludeId) throw new DomainException("SLUG_TAKEN", "Bu slug band.");
    }
    if (sku) {
      const bySku = await this.prisma.product.findUnique({ where: { sku } });
      if (bySku && bySku.id !== excludeId) throw new DomainException("SKU_TAKEN", "Bu SKU band.");
    }
  }
}
