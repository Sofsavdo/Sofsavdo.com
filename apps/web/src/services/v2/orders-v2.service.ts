/**
 * Simplified Orders Service (V2)
 * 
 * Service for calling the simplified v2 orders API.
 * Hides technical fields like attribution, commission details.
 */

// Placeholder - will integrate with actual API client in Phase 2
// import { api } from '@/lib/api-client';

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
   * List simplified orders.
   */
  async list(query: {
    skip?: number;
    take?: number;
    status?: string;
  } = {}): Promise<SimplifiedOrderListDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
  },

  /**
   * Get simplified order by ID.
   */
  async findOne(id: string): Promise<SimplifiedOrderDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      id,
      customerName: 'Placeholder',
      customerPhone: '+998 90 123 45 67',
      customerAddress: undefined,
      items: [],
      totalMinor: 0,
      status: 'PAID',
      paymentMethod: 'click',
      createdAt: new Date(),
    };
  },

  /**
   * Update order status.
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<SimplifiedOrderDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      id,
      customerName: 'Placeholder',
      customerPhone: '+998 90 123 45 67',
      customerAddress: undefined,
      items: [],
      totalMinor: 0,
      status: dto.status,
      paymentMethod: 'click',
      createdAt: new Date(),
    };
  },

  /**
   * Create simplified order (for buyer checkout).
   */
  async create(dto: CreateSimplifiedOrderDto): Promise<SimplifiedOrderDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      id: 'placeholder-order-id',
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerAddress: dto.customerAddress,
      items: [{
        productId: dto.productId,
        title: 'Placeholder Product',
        quantity: dto.quantity,
        priceMinor: 0,
        totalMinor: 0,
      }],
      totalMinor: 0,
      status: 'PAID',
      paymentMethod: dto.paymentMethod,
      createdAt: new Date(),
    };
  },
};
