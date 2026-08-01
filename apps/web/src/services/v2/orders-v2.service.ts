/**
 * Simplified Orders Service (V2)
 * 
 * Service for calling the simplified v2 orders API.
 * Hides technical fields like attribution, commission details.
 */

import { api } from '@/lib/api-client';

export interface SimplifiedOrderItemDto {
  productId: string;
  title: string;
  quantity: number;
  priceMinor: number;
  totalMinor: number;
}

export interface SimplifiedOrderDto {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: SimplifiedOrderItemDto[];
  totalMinor: number;
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentMethod: 'click' | 'payme' | 'card';
  createdAt: Date;
}

export interface SimplifiedOrderListDto {
  items: SimplifiedOrderDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UpdateOrderStatusDto {
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
}

export interface CreateSimplifiedOrderDto {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  productId: string;
  quantity: number;
  paymentMethod: 'click' | 'payme' | 'card';
}

export const ordersV2Service = {
  /**
   * List simplified orders (public endpoint for testing).
   */
  async list(query: {
    skip?: number;
    take?: number;
    status?: string;
  } = {}): Promise<SimplifiedOrderListDto> {
    const params = new URLSearchParams();
    if (query.skip !== undefined) params.append('skip', query.skip.toString());
    if (query.take !== undefined) params.append('take', query.take.toString());
    if (query.status) params.append('status', query.status);
    
    return await api.get(`/v2/orders?${params.toString()}`, false);
  },

  /**
   * Get simplified order by ID (public endpoint for testing).
   */
  async findOne(id: string): Promise<SimplifiedOrderDto> {
    return await api.get(`/v2/orders/${id}`, false);
  },

  /**
   * Update order status (requires auth).
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<SimplifiedOrderDto> {
    return await api.put(`/v2/orders/${id}/status`, dto, true);
  },

  /**
   * Create simplified order (for buyer checkout - public endpoint).
   */
  async create(dto: CreateSimplifiedOrderDto): Promise<SimplifiedOrderDto> {
    return await api.post('/v2/orders', dto, false);
  },
};
