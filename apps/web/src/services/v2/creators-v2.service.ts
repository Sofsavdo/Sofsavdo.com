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
   * Get my simplified profile.
   */
  async getMyProfile(): Promise<SimplifiedCreatorProfileDto> {
    return await api.get('/v2/creators/me');
  },

  /**
   * Update my simplified profile.
   */
  async updateMyProfile(dto: UpdateSimplifiedCreatorProfileDto): Promise<SimplifiedCreatorProfileDto> {
    return await api.put('/v2/creators/me', dto);
  },

  /**
   * Get my simplified products.
   */
  async getMyProducts(): Promise<SimplifiedCreatorProductDto[]> {
    return await api.get('/v2/creators/me/products');
  },

  /**
   * Get my active streams with stats.
   */
  async getMyStreams(): Promise<CreatorStreamDto[]> {
    return await api.get('/v2/creators/me/streams');
  },

  /**
   * Get stream detail with referral link.
   */
  async getStreamDetail(productId: string): Promise<CreatorStreamDto> {
    return await api.get(`/v2/creators/me/streams/${productId}`);
  },

  /**
   * Get my earnings data.
   */
  async getMyEarnings(): Promise<CreatorEarningsDto> {
    return await api.get('/v2/creators/me/earnings');
  },

  /**
   * Request withdrawal.
   */
  async requestWithdrawal(amountMinor: number): Promise<{ success: boolean }> {
    return await api.post('/v2/creators/me/earnings/withdraw', { amountMinor });
  },

  /**
   * Generate instant sharing link for a product.
   */
  async generateSharingLink(productId: string): Promise<{ link: string }> {
    return await api.post(`/v2/creators/me/products/${productId}/link`, {});
  },
};
