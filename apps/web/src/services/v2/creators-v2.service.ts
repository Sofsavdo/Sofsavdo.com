/**
 * Simplified Creators Service (V2)
 * 
 * Service for calling the simplified v2 creators API.
 * Hides technical fields like tier, compliance status.
 */

import { api } from '@/lib/api-client';

export interface SimplifiedCreatorProfileDto {
  id: string;
  displayName: string;
  city?: string;
  socialLink?: string;
  payoutMethod?: string;
  payoutDetails?: string;
  availableEarningsMinor: number;
  pendingEarningsMinor: number;
}

export interface UpdateSimplifiedCreatorProfileDto {
  displayName?: string;
  city?: string;
  socialLink?: string;
  payoutMethod?: string;
  payoutDetails?: string;
}

export interface SimplifiedCreatorProductDto {
  productId: string;
  title: string;
  image: string;
  commissionPercent: number;
  views: number;
  orders: number;
  earningsMinor: number;
  sharingLink: string;
}

export interface CreatorStreamDto {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  productPriceMinor: number;
  commissionPercent: number;
  referralLink: string;
  totalClicks: number;
  totalSales: number;
  totalEarningsMinor: number;
  createdAt: Date;
}

export interface CreatorEarningsDto {
  availableBalanceMinor: number;
  pendingEarningsMinor: number;
  totalEarningsMinor: number;
  lifetimeSales: number;
  transactions: Array<{
    id: string;
    type: 'sale' | 'withdrawal';
    amountMinor: number;
    description: string;
    date: string;
  }>;
}

export const creatorsV2Service = {
  /**
   * Get my simplified profile (requires auth).
   */
  async getMyProfile(): Promise<SimplifiedCreatorProfileDto> {
    return await api.get('/v2/creators/me', true);
  },

  /**
   * Update my simplified profile (requires auth).
   */
  async updateMyProfile(dto: UpdateSimplifiedCreatorProfileDto): Promise<SimplifiedCreatorProfileDto> {
    return await api.put('/v2/creators/me', dto, true);
  },

  /**
   * Get my simplified products (requires auth).
   */
  async getMyProducts(): Promise<SimplifiedCreatorProductDto[]> {
    return await api.get('/v2/creators/me/products', true);
  },

  /**
   * Get my active streams with stats (requires auth).
   */
  async getMyStreams(): Promise<CreatorStreamDto[]> {
    return await api.get('/v2/creators/me/streams', true);
  },

  /**
   * Get stream detail with referral link (requires auth).
   */
  async getStreamDetail(productId: string): Promise<CreatorStreamDto> {
    return await api.get(`/v2/creators/me/streams/${productId}`, true);
  },

  /**
   * Get my earnings data (requires auth).
   */
  async getMyEarnings(): Promise<CreatorEarningsDto> {
    return await api.get('/v2/creators/me/earnings', true);
  },

  /**
   * Request withdrawal (requires auth).
   */
  async requestWithdrawal(amountMinor: number): Promise<{ success: boolean }> {
    return await api.post('/v2/creators/me/earnings/withdraw', { amountMinor }, true);
  },

  /**
   * Generate instant sharing link for a product (requires auth).
   */
  async generateSharingLink(productId: string): Promise<{ link: string }> {
    return await api.post(`/v2/creators/me/products/${productId}/link`, {}, true);
  },
};
