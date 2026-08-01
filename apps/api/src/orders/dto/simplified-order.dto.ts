/**
 * Simplified Order DTO
 * 
 * A simplified version of the Order entity for the v2 API.
 * Hides technical fields like attribution, commission details, etc.
 * Focuses on what users actually need: customer, items, total, status.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min, IsArray } from 'class-validator';

export class SimplifiedOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'clh123abc456def'
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Product title',
    example: 'Face Serum'
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1
  })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'Price per item in minor units',
    example: 22500000 // 225,000 so'm
  })
  @IsNumber()
  @Min(0)
  priceMinor!: number;

  @ApiProperty({
    description: 'Total price in minor units',
    example: 22500000 // 225,000 so'm
  })
  @IsNumber()
  @Min(0)
  totalMinor!: number;
}

export class SimplifiedOrderDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'Nilufar'
  })
  @IsString()
  customerName!: string;

  @ApiProperty({
    description: 'Customer phone',
    example: '+998 90 987 65 43'
  })
  @IsString()
  customerPhone!: string;

  @ApiProperty({
    description: 'Customer address',
    example: 'Tashkent, Yunusabad district'
  })
  @IsString()
  @IsOptional()
  customerAddress?: string;

  @ApiProperty({
    description: 'Order items',
    type: [SimplifiedOrderItemDto]
  })
  @IsArray()
  items!: SimplifiedOrderItemDto[];

  @ApiProperty({
    description: 'Total amount in minor units',
    example: 22500000 // 225,000 so'm
  })
  @IsNumber()
  @Min(0)
  totalMinor!: number;

  @ApiProperty({
    description: 'Order status',
    example: 'PAID',
    enum: ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'click',
    enum: ['click', 'payme', 'card']
  })
  @IsString()
  paymentMethod!: string;

  @ApiProperty({
    description: 'Order date',
    example: '2026-08-01T10:00:00Z'
  })
  @IsDateString()
  createdAt!: Date;
}

export class SimplifiedOrderListDto {
  @ApiProperty({
    description: 'List of simplified orders',
    type: [SimplifiedOrderDto]
  })
  items!: SimplifiedOrderDto[];

  @ApiProperty({
    description: 'Total number of orders',
    example: 100
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20
  })
  pageSize!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5
  })
  totalPages!: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    example: 'SHIPPED',
    enum: ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
  })
  @IsString()
  status!: string;
}

export class CreateSimplifiedOrderDto {
  @ApiProperty({
    description: 'Customer name',
    example: 'Nilufar'
  })
  @IsString()
  customerName!: string;

  @ApiProperty({
    description: 'Customer phone',
    example: '+998 90 987 65 43'
  })
  @IsString()
  customerPhone!: string;

  @ApiProperty({
    description: 'Customer address',
    example: 'Tashkent, Yunusabad district'
  })
  @IsString()
  @IsOptional()
  customerAddress?: string;

  @ApiProperty({
    description: 'Product ID',
    example: 'clh123abc456def'
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1
  })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'click',
    enum: ['click', 'payme', 'card']
  })
  @IsString()
  paymentMethod!: string;
}
