/**
 * Simplified Auth Service (V2)
 * 
 * Service for calling the simplified v2 auth API.
 * Phone-only login, 3-step registration, SMS verification.
 */

import { api } from '@/lib/api-client';

export interface SimplifiedRegisterDto {
  displayName: string;
  phone: string;
  city?: string;
  socialLink?: string;
}

export interface SimplifiedPhoneLoginDto {
  phone: string;
}

export interface VerifySmsDto {
  phone: string;
  code: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  userId: string;
  creatorId?: string;
  role: string;
}

export const authV2Service = {
  /**
   * Simplified registration - 3 steps only.
   */
  async register(dto: SimplifiedRegisterDto): Promise<AuthResponseDto> {
    const response = await api.post('/v2/auth/register', dto);
    return response.data;
  },

  /**
   * Phone-only login.
   */
  async phoneLogin(dto: SimplifiedPhoneLoginDto): Promise<{ message: string }> {
    const response = await api.post('/v2/auth/login/phone', dto);
    return response.data;
  },

  /**
   * Verify SMS code and complete login.
   */
  async verifySms(dto: VerifySmsDto): Promise<AuthResponseDto> {
    const response = await api.post('/v2/auth/verify-sms', dto);
    return response.data;
  },
};
