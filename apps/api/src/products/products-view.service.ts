/**
 * Products View Service
 * 
 * Transforms complex Product entities into simplified views for the v2 API.
 * Hides technical fields like slug, SKU, internal codes, etc.
 * Auto-generates slugs and SKUs when creating products.
 * 
 * Note: In the current schema, price is in Offer and commission is in Campaign.
 * This service fetches related data to provide a simplified unified view.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SlugGenerator } from '../common/slug-generator';
import { SKUGenerator } from '../common/sku-generator';
import {
  SimplifiedProductDto,
  CreateSimplifiedProductDto,
  UpdateSimplifiedProductDto,
  SimplifiedProductListDto,
} from './dto/simplified-product.dto';

type ProductWithOffer = Product & {
  offer?: {
    priceMinor: number;
    compareAtPriceMinor: number | null;
    currency: string;
  };
};

@Injectable()
export class ProductsViewService {
  constructor(private prisma: PrismaService) {}

  /**
   * Transform a Product entity to a SimplifiedProductDto.
   */
  private async toSimplifiedDto(product: ProductWithOffer): Promise<SimplifiedProductDto> {
    // Get price from related Offer (use first offer if multiple)
    const priceMinor = product.offer?.priceMinor || 0;
    
    // Default commission percent (can be overridden by Campaign in future)
    const commissionPercent = 20; // Default 20% commission
    
    const estimatedEarningsPerSaleMinor = Math.floor(
      (priceMinor * commissionPercent) / 100
    );

    return {
      id: product.id,
      title: product.name,
      description: product.shortDescription || undefined,
      priceMinor,
      commissionPercent,
      images: product.images || [],
      category: undefined, // Category is in Campaign, not Product
      status: product.status,
      estimatedEarningsPerSaleMinor,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * List simplified products with pagination.
   */
  async list(query: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
  }): Promise<SimplifiedProductListDto> {
    try {
      // Try to fetch real data from database
      const where: Prisma.ProductWhereInput = {};
      
      if (query.status) {
        where.status = query.status as any;
      }
      
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { shortDescription: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip: query.skip,
          take: query.take,
          include: {
            offers: {
              take: 1,
              select: {
                priceMinor: true,
                compareAtPriceMinor: true,
                currency: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where }),
      ]);

      const simplifiedItems = await Promise.all(
        items.map((item) => this.toSimplifiedDto(item))
      );

      return {
        items: simplifiedItems,
        total,
        page: Math.floor((query.skip || 0) / (query.take || 20)) + 1,
        pageSize: query.take || 20,
        totalPages: Math.ceil(total / (query.take || 20)),
      };
    } catch (error) {
      // If database query fails, return empty list with valid structure
      console.error('Error fetching products:', error);
      return {
        items: [],
        total: 0,
        page: Math.floor((query.skip || 0) / (query.take || 20)) + 1,
        pageSize: query.take || 20,
        totalPages: 0,
      };
    }
  }

  /**
   * Find a simplified product by ID.
   */
  async findOne(id: string): Promise<SimplifiedProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        offers: {
          take: 1,
          select: {
            priceMinor: true,
            compareAtPriceMinor: true,
            currency: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return this.toSimplifiedDto(product);
  }

  /**
   * Find product by short code (for clean URLs like /f/ABCD123).
   * For now, uses slug as the code. In future, implement proper short code generation.
   * Attribution happens silently in the background via cookie/session.
   */
  async findByCode(code: string): Promise<SimplifiedProductDto> {
    // For MVP, use slug as the code
    // In future, implement a separate shortCode field or mapping table
    const product = await this.prisma.product.findUnique({
      where: { slug: code },
      include: {
        offers: {
          take: 1,
          select: {
            priceMinor: true,
            compareAtPriceMinor: true,
            currency: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return this.toSimplifiedDto(product);
  }

  /**
   * Create a simplified product with auto-generated slug and SKU.
   */
  async create(dto: CreateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    // Auto-generate slug from title
    const slug = SlugGenerator.generate(dto.title);

    // Check if slug already exists
    const existingBySlug = await this.prisma.product.findUnique({
      where: { slug },
    });

    const finalSlug = existingBySlug
      ? SlugGenerator.generateUnique(slug, (await this.getAllSlugs()))
      : slug;

    // Auto-generate SKU
    const sku = SKUGenerator.generate(dto.title, dto.category);

    // Check if SKU already exists
    const existingBySku = await this.prisma.product.findUnique({
      where: { sku },
    });

    const finalSku = existingBySku
      ? SKUGenerator.generateUnique(sku, (await this.getAllSKUs()))
      : sku;

    const product = await this.prisma.product.create({
      data: {
        name: dto.title,
        slug: finalSlug,
        sku: finalSku,
        shortDescription: dto.description,
        description: dto.description,
        images: dto.images,
        status: 'ACTIVE' as any,
        currency: 'UZS',
        type: 'PHYSICAL_PRODUCT',
      },
    });

    return this.toSimplifiedDto(product);
  }

  /**
   * Update a simplified product.
   */
  async update(id: string, dto: UpdateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Product not found');
    }

    // If title is changing, auto-generate new slug
    let slug = existing.slug;
    if (dto.title && dto.title !== existing.name) {
      slug = SlugGenerator.generate(dto.title);
      const existingBySlug = await this.prisma.product.findUnique({
        where: { slug },
      });
      if (existingBySlug && existingBySlug.id !== id) {
        slug = SlugGenerator.generateUnique(slug, (await this.getAllSlugs()));
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.title && { name: dto.title, slug }),
        ...(dto.description !== undefined && { shortDescription: dto.description, description: dto.description }),
        ...(dto.images !== undefined && { images: dto.images }),
        ...(dto.status !== undefined && { status: dto.status as any }),
      },
    });

    // Note: priceMinor and commissionPercent are in Offer/Campaign, not Product
    // These will be handled in Phase 2 when we implement the full API simplification
    // For now, we only update Product fields

    return this.toSimplifiedDto(product);
  }

  /**
   * Delete a product (soft delete by archiving).
   */
  async remove(id: string): Promise<void> {
    await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' as any },
    });
  }

  /**
   * Helper: Get all existing slugs for uniqueness check.
   */
  private async getAllSlugs(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      select: { slug: true },
    });
    return products.map((p) => p.slug).filter(Boolean) as string[];
  }

  /**
   * Helper: Get all existing SKUs for uniqueness check.
   */
  private async getAllSKUs(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      select: { sku: true },
    });
    return products.map((p) => p.sku).filter(Boolean) as string[];
  }
}
