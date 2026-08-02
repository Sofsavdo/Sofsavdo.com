/**
 * Simplified Products Service (V2)
 *
 * Service for calling the simplified v2 products API.
 * Hides technical fields like slug, SKU, internal codes.
 */

import { api } from '@/lib/api-client';

const STORAGE_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL || 'https://api.sofsavdo.com/media';

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return `${STORAGE_PUBLIC_BASE_URL}/${imagePath}`;
}

export interface SimplifiedProductDto {
  id: string;
  title: string;
  description?: string;
  priceMinor: number;
  commissionPercent: number;
  images: string[];
  category?: string;
  status: string;
  estimatedEarningsPerSaleMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSimplifiedProductDto {
  title: string;
  description?: string;
  priceMinor: number;
  commissionPercent: number;
  images: string[];
  category?: string;
}

export interface UpdateSimplifiedProductDto {
  title?: string;
  description?: string;
  priceMinor?: number;
  commissionPercent?: number;
  images?: string[];
  category?: string;
  status?: string;
}

export interface SimplifiedProductListDto {
  items: SimplifiedProductDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const productsV2Service = {
  /**
   * List simplified products (public endpoint).
   */
  async list(query: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
  } = {}): Promise<SimplifiedProductListDto> {
    const params = new URLSearchParams();
    if (query.skip) params.append('skip', query.skip.toString());
    if (query.take) params.append('take', query.take.toString());
    if (query.status) params.append('status', query.status);
    if (query.search) params.append('search', query.search);
    const result = await api.get<SimplifiedProductListDto>(`/v2/products?${params.toString()}`, false);
    return {
      ...result,
      items: result.items.map(product => ({
        ...product,
        images: product.images.map(img => toImageUrl(img) || img)
      }))
    };
  },

  /**
   * Get simplified product by ID (public endpoint).
   */
  async findOne(id: string): Promise<SimplifiedProductDto> {
    return await api.get(`/v2/products/${id}`, false);
  },

  /**
   * Find product by short code (for clean URLs like /f/ABCD123).
   * Attribution happens silently in the background (public endpoint).
   */
  async findByCode(code: string): Promise<SimplifiedProductDto> {
    return await api.get(`/v2/products/by-code/${code}`, false);
  },

  /**
   * Create simplified product (auto-generates slug and SKU) - requires auth.
   */
  async create(dto: CreateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    return await api.post('/v2/products', dto, true);
  },

  /**
   * Update simplified product - requires auth.
   */
  async update(id: string, dto: UpdateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    return await api.put(`/v2/products/${id}`, dto, true);
  },

  /**
   * Delete product (soft delete by archiving) - requires auth.
   */
  async remove(id: string): Promise<void> {
    await api.delete(`/v2/products/${id}`, true);
  },
};
