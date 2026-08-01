/**
 * Orders View Service
 * 
 * Transforms complex Order entities into simplified views for the v2 API.
 * Hides technical fields like attribution, commission details, etc.
 * Focuses on what users actually need: customer, items, total, status.
 * 
 * Note: This is a simplified placeholder service. Full implementation
 * will be done in Phase 2 when we implement the complete API simplification.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SimplifiedOrderDto,
  SimplifiedOrderListDto,
  UpdateOrderStatusDto,
  CreateSimplifiedOrderDto,
} from './dto/simplified-order.dto';

@Injectable()
export class OrdersViewService {
  constructor(private prisma: PrismaService) {}

  /**
   * Transform an Order entity to a SimplifiedOrderDto.
   */
  private async toSimplifiedDto(order: any): Promise<SimplifiedOrderDto> {
    // Get order items
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId: order.id },
      include: {
        variant: {
          include: {
            offer: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    const items = orderItems.map((item) => ({
      productId: item.variant?.offer?.product?.id || '',
      title: item.nameSnapshot,
      quantity: item.quantity,
      priceMinor: item.unitPriceMinor,
      totalMinor: item.totalMinor,
    }));

    return {
      id: order.id,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      customerAddress: order.deliveryAddress || undefined,
      items,
      totalMinor: order.totalMinor,
      status: order.status,
      paymentMethod: order.paymentMethod || 'click',
      createdAt: order.createdAt,
    };
  }

  /**
   * List simplified orders with pagination.
   */
  async list(query: {
    skip?: number;
    take?: number;
    status?: string;
  }): Promise<SimplifiedOrderListDto> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status as any }),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: query.skip || 0,
        take: query.take || 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
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
  }

  /**
   * Find a simplified order by ID.
   */
  async findOne(id: string): Promise<SimplifiedOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return this.toSimplifiedDto(order);
  }

  /**
   * Update order status.
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<SimplifiedOrderDto> {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status as any },
    });

    return this.toSimplifiedDto(order);
  }

  /**
   * Create a simplified order (for buyer checkout).
   */
  async create(dto: CreateSimplifiedOrderDto): Promise<SimplifiedOrderDto> {
    // Get product/offer info
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        offers: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!product || product.offers.length === 0) {
      throw new Error('Product not available');
    }

    const offer = product.offers[0];
    if (!offer) {
      throw new Error('No active offer found');
    }

    const offerVariant = await this.prisma.offerVariant.findFirst({
      where: { offerId: offer.id, isDefault: true },
    });

    if (!offerVariant) {
      throw new Error('No variant available');
    }

    const unitPriceMinor = offerVariant.priceMinor;
    const totalMinor = unitPriceMinor * dto.quantity;

    // Create or find customer
    let customer = await this.prisma.customer.findFirst({
      where: { phone: dto.customerPhone },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          fullName: dto.customerName,
          phone: dto.customerPhone,
        },
      });
    }

    // Create address if provided
    let addressId = undefined;
    if (dto.customerAddress) {
      const address = await this.prisma.address.create({
        data: {
          customerId: customer.id,
          region: 'Toshkent',
          city: 'Tashkent',
          line1: dto.customerAddress,
        },
      });
      addressId = address.id;
    }

    // Create order
    const order = await this.prisma.order.create({
      data: {
        type: 'PHYSICAL',
        offerId: offer.id,
        customerId: customer.id,
        addressId,
        status: 'CREATED',
        subtotalMinor: totalMinor,
        totalMinor,
        currency: 'UZS',
        deliveryMethod: 'courier',
        idempotencyKey: `${dto.customerPhone}-${Date.now()}`,
        offerSnapshot: {
          offer: {
            id: offer.id,
            name: offer.name,
            priceMinor: offer.priceMinor,
          },
          variant: {
            id: offerVariant.id,
            name: offerVariant.name,
            priceMinor: offerVariant.priceMinor,
          },
        },
      },
    });

    // Create order item
    await this.prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId: offerVariant.id,
        nameSnapshot: product.name,
        quantity: dto.quantity,
        unitPriceMinor,
        totalMinor,
      },
    });

    return this.toSimplifiedDto(order);
  }
}
