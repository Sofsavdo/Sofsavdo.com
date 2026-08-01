/**
 * Simplified Creator DTO
 * 
 * A simplified version of the Creator entity for the v2 API.
 * Hides technical fields like tier, compliance status, etc.
 * Focuses on what users actually need: name, social, earnings.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max, IsUrl } from 'class-validator';

export class SimplifiedCreatorDto {
  @ApiProperty({
    description: 'Creator ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Creator display name',
    example: 'Malika'
  })
  @IsString()
  displayName!: string;

  @ApiProperty({
    description: 'Creator city',
    example: 'Tashkent',
    required: false
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Social media link',
    example: 'https://instagram.com/malika',
    required: false
  })
  @IsUrl()
  @IsOptional()
  socialLink?: string;

  @ApiProperty({
    description: 'Available earnings in minor units',
    example: 40500000 // 405,000 so'm
  })
  @IsNumber()
  @Min(0)
  availableEarningsMinor!: number;

  @ApiProperty({
    description: 'Pending earnings in minor units',
    example: 12500000 // 125,000 so'm
  })
  @IsNumber()
  @Min(0)
  pendingEarningsMinor!: number;

  @ApiProperty({
    description: 'Total orders',
    example: 45
  })
  @IsNumber()
  @Min(0)
  totalOrders!: number;

  @ApiProperty({
    description: 'Total views/clicks',
    example: 1234
  })
  @IsNumber()
  @Min(0)
  totalViews!: number;

  @ApiProperty({
    description: 'Creator status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'BLOCKED', 'PENDING']
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2026-08-01T10:00:00Z'
  })
  createdAt!: Date;
}

export class SimplifiedCreatorProfileDto {
  @ApiProperty({
    description: 'Creator ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Creator display name',
    example: 'Malika'
  })
  @IsString()
  displayName!: string;

  @ApiProperty({
    description: 'Creator city',
    example: 'Tashkent',
    required: false
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Social media link',
    example: 'https://instagram.com/malika',
    required: false
  })
  @IsUrl()
  @IsOptional()
  socialLink?: string;

  @ApiProperty({
    description: 'Payout method (card or bank)',
    example: 'card',
    enum: ['card', 'bank'],
    required: false
  })
  @IsString()
  @IsOptional()
  payoutMethod?: string;

  @ApiProperty({
    description: 'Payout details (card number or bank account)',
    example: '****1234',
    required: false
  })
  @IsString()
  @IsOptional()
  payoutDetails?: string;

  @ApiProperty({
    description: 'Available earnings in minor units',
    example: 40500000
  })
  @IsNumber()
  @Min(0)
  availableEarningsMinor!: number;

  @ApiProperty({
    description: 'Pending earnings in minor units',
    example: 12500000
  })
  @IsNumber()
  @Min(0)
  pendingEarningsMinor!: number;
}

export class UpdateSimplifiedCreatorProfileDto {
  @ApiProperty({
    description: 'Creator display name',
    example: 'Malika',
    required: false
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    description: 'Creator city',
    example: 'Tashkent',
    required: false
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Social media link',
    example: 'https://instagram.com/malika',
    required: false
  })
  @IsUrl()
  @IsOptional()
  socialLink?: string;

  @ApiProperty({
    description: 'Payout method (card or bank)',
    example: 'card',
    enum: ['card', 'bank'],
    required: false
  })
  @IsString()
  @IsOptional()
  payoutMethod?: string;

  @ApiProperty({
    description: 'Payout details (card number or bank account)',
    example: '****1234',
    required: false
  })
  @IsString()
  @IsOptional()
  payoutDetails?: string;
}

export class SimplifiedCreatorProductDto {
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
    description: 'Product image',
    example: 'https://cdn.sofsavdo.com/products/serum-1.jpg'
  })
  @IsUrl()
  image!: string;

  @ApiProperty({
    description: 'Commission percentage',
    example: 20
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;

  @ApiProperty({
    description: 'Views for this creator',
    example: 1234
  })
  @IsNumber()
  @Min(0)
  views!: number;

  @ApiProperty({
    description: 'Orders for this creator',
    example: 45
  })
  @IsNumber()
  @Min(0)
  orders!: number;

  @ApiProperty({
    description: 'Earnings for this creator in minor units',
    example: 40500000
  })
  @IsNumber()
  @Min(0)
  earningsMinor!: number;

  @ApiProperty({
    description: 'Sharing link',
    example: 'https://sofsavdo.com/f/A82KD9'
  })
  @IsUrl()
  sharingLink!: string;
}
