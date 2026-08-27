import { Injectable } from "@nestjs/common";
import type { Prisma, Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { ProductQueryDto } from "./dto/product-query.dto";

// A blank text input submits "" (not undefined/omitted) — writing that literally into `sku`
// (unique) collides with any other product also left blank (Postgres treats "" as a real,
// non-distinct value, unlike NULL), and into `creatorProfileId` (a foreign key) fails lookup
// entirely since no CreatorProfile has id "". Both must become a real absence of value instead.
function emptyToNull(value: string | undefined | null): string | undefined | null {
  return value === "" ? null : value;
}

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
      orderBy: [{ isPinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
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
        commissionType: true,
        commissionRateBps: true,
        commissionAmountMinor: true,
        isPinned: true,
        pinnedAt: true,
        featuredBadge: true,
        externalRedirectUrl: true,
        externalPartner: true,
        estimatedEarningLabel: true,
      },
    });
  }

  // Pinned products sort first (most-recently-pinned first among them), matching the "creators
  // should see this one first" ask directly — everything else falls back to newest-first, as
  // before this feature existed.
  async listAvailableForPromotion(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        status: "ACTIVE",
        // A product is promotable either the normal way (has a live Offer to check out through)
        // or as a partner-platform redirect (externalRedirectUrl set — see Product's schema
        // comment) — the latter is never sold through an Offer at all, so requiring one would
        // make it permanently invisible in the creator-facing picker.
        OR: [{ offers: { some: { status: "ACTIVE" } } }, { externalRedirectUrl: { not: null } }],
      },
      orderBy: [{ isPinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
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
        commissionType: true,
        commissionRateBps: true,
        commissionAmountMinor: true,
        isPinned: true,
        pinnedAt: true,
        featuredBadge: true,
        externalRedirectUrl: true,
        externalPartner: true,
        estimatedEarningLabel: true,
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
    const sku = emptyToNull(dto.sku);
    const creatorProfileId = emptyToNull(dto.creatorProfileId);
    await this.assertSlugAndSkuAvailable(dto.slug, sku ?? undefined);
    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        shortDescription: dto.shortDescription,
        description: dto.description,
        brand: dto.brand,
        sku,
        images: dto.images ?? [],
        videos: dto.videos ?? [],
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
        costPriceMinor: dto.costPriceMinor,
        currency: dto.currency ?? "UZS",
        internalNotes: dto.internalNotes,
        creatorProfileId,
        status: dto.status ?? "DRAFT",
        commissionType: dto.commissionType,
        commissionRateBps: dto.commissionRateBps,
        commissionAmountMinor: dto.commissionAmountMinor,
        featuredBadge: dto.featuredBadge,
        externalRedirectUrl: dto.externalRedirectUrl,
        externalPartner: dto.externalPartner,
        estimatedEarningLabel: dto.estimatedEarningLabel,
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
    const sku = emptyToNull(dto.sku);
    const creatorProfileId = emptyToNull(dto.creatorProfileId);
    if (dto.slug && dto.slug !== existing.slug) await this.assertSlugAndSkuAvailable(dto.slug, undefined, id);
    if (sku && sku !== existing.sku) await this.assertSlugAndSkuAvailable(undefined, sku, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        shortDescription: dto.shortDescription,
        description: dto.description,
        brand: dto.brand,
        sku,
        images: dto.images,
        videos: dto.videos,
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
        costPriceMinor: dto.costPriceMinor,
        currency: dto.currency,
        internalNotes: dto.internalNotes,
        status: dto.status,
        creatorProfileId,
        commissionType: dto.commissionType,
        commissionRateBps: dto.commissionRateBps,
        commissionAmountMinor: dto.commissionAmountMinor,
        featuredBadge: dto.featuredBadge,
        externalRedirectUrl: dto.externalRedirectUrl,
        externalPartner: dto.externalPartner,
        estimatedEarningLabel: dto.estimatedEarningLabel,
      },
    });
  }

  async pin(id: string): Promise<Product> {
    await this.findOneOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: { isPinned: true, pinnedAt: new Date() } });
  }

  async unpin(id: string): Promise<Product> {
    await this.findOneOrThrow(id);
    return this.prisma.product.update({ where: { id }, data: { isPinned: false, pinnedAt: null } });
  }

  async archive(id: string): Promise<Product> {
    await this.findOneOrThrow(id);
    const archived = await this.prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    // Every creator's existing Flow for this product otherwise keeps redirecting/counting clicks
    // indefinitely — createFlow() already blocks NEW flows against a non-ACTIVE product, but
    // nothing previously stopped ones created before the archive. Pausing (not deleting) preserves
    // the Flow's real clickCount/orderCount/commissionEarnedMinor history and every Order/Commission
    // that references it; FlowsService.getFlowByReferralCode already treats any non-ACTIVE status as
    // blocked, so this alone stops the referral link from working, and the creator-facing status
    // badge ("Faol"/"To'xtatilgan") already reflects it with no frontend change needed.
    await this.prisma.flow.updateMany({ where: { productId: id, status: "ACTIVE" }, data: { status: "PAUSED" } });
    return archived;
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
