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

export const creatorsV2Service = {
  /**
   * Get my simplified profile.
   */
  async getMyProfile(): Promise<SimplifiedCreatorProfileDto> {
    const response = await api.get('/v2/creators/me');
    return response.data;
  },

  /**
   * Update my simplified profile.
   */
  async updateMyProfile(dto: UpdateSimplifiedCreatorProfileDto): Promise<SimplifiedCreatorProfileDto> {
    const response = await api.put('/v2/creators/me', dto);
    return response.data;
  },

  /**
   * Get my simplified products.
   */
  async getMyProducts(): Promise<SimplifiedCreatorProductDto[]> {
    const response = await api.get('/v2/creators/me/products');
    return response.data;
  },

  /**
   * Generate instant sharing link for a product.
   */
  async generateSharingLink(productId: string): Promise<{ link: string }> {
    const response = await api.post(`/v2/creators/me/products/${productId}/link`);
    return response.data;
  },
};
