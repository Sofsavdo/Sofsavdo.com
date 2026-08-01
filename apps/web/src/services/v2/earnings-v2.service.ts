/**
 * Simplified Earnings Service (V2)
 * 
 * Service for calling the simplified v2 earnings API.
 * Merges balance, commissions, and payouts into a single "Earnings" concept.
 */

// Placeholder - will integrate with actual API client in Phase 2
// import { api } from '@/lib/api-client';

export interface SimplifiedEarningsDto {
  availableMinor: number;
  pendingMinor: number;
  totalLifetimeMinor: number;
  thisMonthMinor: number;
  todayMinor: number;
}

export interface SimplifiedTransactionDto {
  id: string;
  type: 'ORDER' | 'WITHDRAWAL' | 'REFUND';
  description: string;
  amountMinor: number;
  date: Date;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export interface SimplifiedEarningsWithTransactionsDto extends SimplifiedEarningsDto {
  recentTransactions: SimplifiedTransactionDto[];
}

export interface CreateWithdrawalDto {
  amountMinor: number;
  payoutMethod?: string;
}

export interface SimplifiedWithdrawalDto {
  id: string;
  amountMinor: number;
  payoutMethod: string;
  status: 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
  requestedAt: Date;
  expectedAt?: Date;
  processedAt?: Date;
}

export const earningsV2Service = {
  /**
   * Get my simplified earnings.
   */
  async getMyEarnings(): Promise<SimplifiedEarningsDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      availableMinor: 0,
      pendingMinor: 0,
      totalLifetimeMinor: 0,
      thisMonthMinor: 0,
      todayMinor: 0,
    };
  },

  /**
   * Get my earnings with recent transactions.
   */
  async getMyEarningsWithTransactions(): Promise<SimplifiedEarningsWithTransactionsDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      availableMinor: 0,
      pendingMinor: 0,
      totalLifetimeMinor: 0,
      thisMonthMinor: 0,
      todayMinor: 0,
      recentTransactions: [],
    };
  },

  /**
   * Create a withdrawal request.
   */
  async createWithdrawal(dto: CreateWithdrawalDto): Promise<SimplifiedWithdrawalDto> {
    // Placeholder - will integrate with actual API client in Phase 2
    return {
      id: 'placeholder',
      amountMinor: dto.amountMinor,
      payoutMethod: dto.payoutMethod || 'card',
      status: 'REQUESTED',
      requestedAt: new Date(),
      expectedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    };
  },

  /**
   * Get my withdrawal history.
   */
  async getMyWithdrawals(): Promise<SimplifiedWithdrawalDto[]> {
    // Placeholder - will integrate with actual API client in Phase 2
    return [];
  },
};
