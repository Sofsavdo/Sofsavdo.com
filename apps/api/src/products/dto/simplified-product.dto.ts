/**
 * Simplified Product DTO
 * 
 * A simplified version of the Product entity for the v2 API.
 * Hides technical fields like slug, SKU, internal codes, etc.
 * Focuses on what users actually need: title, price, commission, images.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsUrl, Min, Max } from 'class-validator';

export class SimplifiedProductDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Product title',
    example: 'Face Serum for Glowing Skin'
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Natural face serum for glowing skin with vitamin C',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Product price in minor units (1 so\'m = 100 minor units)',
    example: 22500000 // 225,000 so'm
  })
  @IsNumber()
  @Min(0)
  priceMinor!: number;

  @ApiProperty({
    description: 'Commission percentage',
    example: 20
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;

  @ApiProperty({
    description: 'Product images',
    type: [String],
    example: ['https://cdn.sofsavdo.com/products/serum-1.jpg']
  })
  @IsArray()
  @IsUrl({}, { each: true })
  images!: string[];

  @ApiProperty({
    description: 'Product category',
    example: 'Skincare',
    required: false
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'Product status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED']
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Estimated earnings per sale for creators',
    example: 45000 // 45,000 so'm (20% of 225,000)
  })
  @IsNumber()
  @Min(0)
  estimatedEarningsPerSaleMinor!: number;

  @ApiProperty({
    description: 'Creation date',
    example: '2026-08-01T10:00:00Z'
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2026-08-01T10:00:00Z'
  })
  updatedAt!: Date;
}

export class CreateSimplifiedProductDto {
  @ApiProperty({
    description: 'Product title',
    example: 'Face Serum for Glowing Skin'
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Natural face serum for glowing skin with vitamin C',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Product price in minor units (1 so\'m = 100 minor units)',
    example: 22500000 // 225,000 so'm
  })
  @IsNumber()
  @Min(0)
  priceMinor!: number;

  @ApiProperty({
    description: 'Commission percentage',
    example: 20
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;

  @ApiProperty({
    description: 'Product images (max 5)',
    type: [String],
    example: ['https://cdn.sofsavdo.com/products/serum-1.jpg'],
    maxItems: 5
  })
  @IsArray()
  @IsUrl({}, { each: true })
  images!: string[];

  @ApiProperty({
    description: 'Product category',
    example: 'Skincare',
    required: false
  })
  @IsString()
  @IsOptional()
  category?: string;
}

export class UpdateSimplifiedProductDto {
  @ApiProperty({
    description: 'Product title',
    example: 'Face Serum for Glowing Skin',
    required: false
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Natural face serum for glowing skin with vitamin C',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Product price in minor units (1 so\'m = 100 minor units)',
    example: 22500000,
    required: false
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceMinor?: number;

  @ApiProperty({
    description: 'Commission percentage',
    example: 20,
    required: false
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  commissionPercent?: number;

  @ApiProperty({
    description: 'Product images (max 5)',
    type: [String],
    example: ['https://cdn.sofsavdo.com/products/serum-1.jpg'],
    required: false,
    maxItems: 5
  })
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({
    description: 'Product category',
    example: 'Skincare',
    required: false
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'Product status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    required: false
  })
  @IsString()
  @IsOptional()
  status?: string;
}

export class SimplifiedProductListDto {
  @ApiProperty({
    description: 'List of simplified products',
    type: [SimplifiedProductDto]
  })
  items!: SimplifiedProductDto[];

  @ApiProperty({
    description: 'Total number of products',
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
