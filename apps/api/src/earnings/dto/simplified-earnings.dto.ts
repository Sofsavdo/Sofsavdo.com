/**
 * Simplified Earnings DTO
 * 
 * A simplified version of earnings-related entities for the v2 API.
 * Merges balance, commissions, and payouts into a single "Earnings" concept.
 * Hides technical fields like commission ledger, payout details, etc.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

export class SimplifiedEarningsDto {
  @ApiProperty({
    description: 'Available earnings in minor units (can be withdrawn)',
    example: 40500000 // 405,000 so'm
  })
  @IsNumber()
  @Min(0)
  availableMinor!: number;

  @ApiProperty({
    description: 'Pending earnings in minor units (waiting for order confirmation)',
    example: 12500000 // 125,000 so'm
  })
  @IsNumber()
  @Min(0)
  pendingMinor!: number;

  @ApiProperty({
    description: 'Total earnings (lifetime) in minor units',
    example: 1500000000 // 15,000,000 so'm
  })
  @IsNumber()
  @Min(0)
  totalLifetimeMinor!: number;

  @ApiProperty({
    description: 'This month earnings in minor units',
    example: 125000000 // 1,250,000 so'm
  })
  @IsNumber()
  @Min(0)
  thisMonthMinor!: number;

  @ApiProperty({
    description: 'Today earnings in minor units',
    example: 25000000 // 250,000 so'm
  })
  @IsNumber()
  @Min(0)
  todayMinor!: number;
}

export class SimplifiedTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'ORDER',
    enum: ['ORDER', 'WITHDRAWAL', 'REFUND']
  })
  @IsString()
  type!: string;

  @ApiProperty({
    description: 'Transaction description',
    example: 'Order #12345 - Face Serum'
  })
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Amount in minor units (positive for earnings, negative for withdrawals)',
    example: 9000 // 9,000 so'm
  })
  @IsNumber()
  amountMinor!: number;

  @ApiProperty({
    description: 'Transaction date',
    example: '2026-08-01T10:00:00Z'
  })
  @IsDateString()
  date!: Date;

  @ApiProperty({
    description: 'Transaction status',
    example: 'COMPLETED',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']
  })
  @IsString()
  status!: string;
}

export class SimplifiedEarningsWithTransactionsDto extends SimplifiedEarningsDto {
  @ApiProperty({
    description: 'Recent transactions',
    type: [SimplifiedTransactionDto]
  })
  recentTransactions!: SimplifiedTransactionDto[];
}

export class CreateWithdrawalDto {
  @ApiProperty({
    description: 'Amount to withdraw in minor units',
    example: 40000000 // 400,000 so'm
  })
  @IsNumber()
  @Min(0)
  amountMinor!: number;

  @ApiProperty({
    description: 'Payout method (card or bank)',
    example: 'card',
    enum: ['card', 'bank'],
    required: false
  })
  @IsString()
  @IsOptional()
  payoutMethod?: string;
}

export class SimplifiedWithdrawalDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: 'clh123abc456def'
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Amount in minor units',
    example: 40000000 // 400,000 so'm
  })
  @IsNumber()
  amountMinor!: number;

  @ApiProperty({
    description: 'Payout method',
    example: 'card',
    enum: ['card', 'bank']
  })
  @IsString()
  payoutMethod!: string;

  @ApiProperty({
    description: 'Withdrawal status',
    example: 'PROCESSING',
    enum: ['REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']
  })
  @IsString()
  status!: string;

  @ApiProperty({
    description: 'Requested date',
    example: '2026-08-01T10:00:00Z'
  })
  @IsDateString()
  requestedAt!: Date;

  @ApiProperty({
    description: 'Expected processing date',
    example: '2026-08-03T10:00:00Z',
    required: false
  })
  @IsDateString()
  @IsOptional()
  expectedAt?: Date;

  @ApiProperty({
    description: 'Processed date',
    example: '2026-08-03T10:00:00Z',
    required: false
  })
  @IsDateString()
  @IsOptional()
  processedAt?: Date;
}
