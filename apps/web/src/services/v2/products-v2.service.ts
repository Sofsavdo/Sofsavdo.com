/**
 * Simplified Products Service (V2)
 * 
 * Service for calling the simplified v2 products API.
 * Hides technical fields like slug, SKU, internal codes.
 */

import { api } from '@/lib/api-client';

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
   * List simplified products.
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
    return await api.get(`/v2/products?${params.toString()}`);
  },

  /**
   * Get simplified product by ID.
   */
  async findOne(id: string): Promise<SimplifiedProductDto> {
    return await api.get(`/v2/products/${id}`);
  },

  /**
   * Find product by short code (for clean URLs like /f/ABCD123).
   * Attribution happens silently in the background.
   */
  async findByCode(code: string): Promise<SimplifiedProductDto> {
    return await api.get(`/v2/products/by-code/${code}`);
  },

  /**
   * Create simplified product (auto-generates slug and SKU).
   */
  async create(dto: CreateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    return await api.post('/v2/products', dto);
  },

  /**
   * Update simplified product.
   */
  async update(id: string, dto: UpdateSimplifiedProductDto): Promise<SimplifiedProductDto> {
    return await api.put(`/v2/products/${id}`, dto);
  },

  /**
   * Delete product (soft delete by archiving).
   */
  async remove(id: string): Promise<void> {
    await api.delete(`/v2/products/${id}`);
  },
};
