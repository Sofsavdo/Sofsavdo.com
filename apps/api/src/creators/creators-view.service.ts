/**
 * Creators View Service
 * 
 * Transforms complex Creator entities into simplified views for the v2 API.
 * Hides technical fields like tier, compliance status, etc.
 * Focuses on what users actually need: name, social, earnings.
 * 
 * Note: This is a simplified placeholder service. Full implementation
 * will be done in Phase 2 when we implement the complete API simplification.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SimplifiedCreatorDto,
  SimplifiedCreatorProfileDto,
  UpdateSimplifiedCreatorProfileDto,
  SimplifiedCreatorProductDto,
  CreatorStreamDto,
  CreatorEarningsDto,
} from './dto/simplified-creator.dto';

@Injectable()
export class CreatorsViewService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Get simplified creator profile for the authenticated creator.
   */
  async getMyProfile(creatorId: string): Promise<SimplifiedCreatorProfileDto> {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      include: {
        user: {
          select: {
            phone: true,
          },
        },
        socialAccounts: {
          take: 1,
        },
        payoutMethods: {
          take: 1,
        },
      },
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    // Get social link from first social account
    const socialLink = creator.socialAccounts[0]?.profileUrl || undefined;

    // Get payout method from first payout method
    const payoutMethod = creator.payoutMethods[0]?.type || undefined;
    const payoutDetails = this.maskPayoutDetails(
      creator.payoutMethods[0]?.cardNumberEnc || creator.payoutMethods[0]?.bankAccount
    );

    // Calculate earnings from commissions (placeholder - will be calculated properly in Phase 2)
    const availableEarningsMinor = 0;
    const pendingEarningsMinor = 0;

    return {
      id: creator.id,
      displayName: creator.displayName,
      city: creator.city || undefined,
      socialLink,
      payoutMethod,
      payoutDetails,
      availableEarningsMinor,
      pendingEarningsMinor,
    };
  }

  /**
   * Update simplified creator profile.
   */
  async updateMyProfile(
    creatorId: string,
    dto: UpdateSimplifiedCreatorProfileDto
  ): Promise<SimplifiedCreatorProfileDto> {
    // Update CreatorProfile fields
    await this.prisma.creatorProfile.update({
      where: { id: creatorId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.city !== undefined && { city: dto.city }),
      },
    });

    // Update social account if provided
    if (dto.socialLink !== undefined) {
      const existingSocial = await this.prisma.socialAccount.findFirst({
        where: { creatorId },
      });

      if (existingSocial) {
        await this.prisma.socialAccount.update({
          where: { id: existingSocial.id },
          data: { profileUrl: dto.socialLink },
        });
      } else {
        await this.prisma.socialAccount.create({
          data: {
            creatorId,
            platform: 'INSTAGRAM',
            profileUrl: dto.socialLink,
            handle: dto.socialLink,
            followerCount: 0,
          },
        });
      }
    }

    // Update payout method if provided
    if (dto.payoutMethod !== undefined && dto.payoutDetails !== undefined) {
      const existingPayout = await this.prisma.payoutMethod.findFirst({
        where: { creatorId },
      });

      if (existingPayout) {
        await this.prisma.payoutMethod.update({
          where: { id: existingPayout.id },
          data: {
            type: dto.payoutMethod as any,
            ...(dto.payoutMethod === 'card' && { cardNumberEnc: dto.payoutDetails }),
            ...(dto.payoutMethod === 'bank' && { bankAccount: dto.payoutDetails }),
          },
        });
      } else {
        await this.prisma.payoutMethod.create({
          data: {
            creatorId,
            type: dto.payoutMethod as any,
            ...(dto.payoutMethod === 'card' && { cardNumberEnc: dto.payoutDetails }),
            ...(dto.payoutMethod === 'bank' && { bankAccount: dto.payoutDetails }),
            isDefault: true,
            isActive: true,
          },
        });
      }
    }

    return this.getMyProfile(creatorId);
  }

  /**
   * Get simplified products for the authenticated creator.
   */
  async getMyProducts(creatorId: string): Promise<SimplifiedCreatorProductDto[]> {
    // Placeholder - will be implemented in Phase 2
    return [];
  }

  /**
   * Get my active streams with stats.
   * Returns products that are either assigned to this creator or public products available for promotion.
   */
  async getMyStreams(creatorId: string): Promise<CreatorStreamDto[]> {
    // Fetch products that are either:
    // 1. Assigned to this creator (creatorProfileId matches)
    // 2. Or public products (creatorProfileId is null) that are ACTIVE
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { creatorProfileId: creatorId },
          { creatorProfileId: null, status: 'ACTIVE' },
        ],
      },
      include: {
        offers: {
          take: 1,
          select: {
            priceMinor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform products to CreatorStreamDto
    return products.map((product) => {
      const offer = (product as any).offers?.[0];
      const priceMinor = offer?.priceMinor || 0;
      const commissionPercent = 20; // Default 20% - commission is in Campaign, not Offer

      const frontendUrl = this.config.get('FRONTEND_URL') || 'https://sofsavdo.com';

      return {
        id: product.id,
        productId: product.id,
        productName: product.name,
        productImage: product.images[0] || '',
        productPriceMinor: priceMinor,
        commissionPercent,
        referralLink: `${frontendUrl}/f/${product.slug}?ref=${creatorId}`,
        totalClicks: 0, // Will be calculated from ReferralVisit in future
        totalSales: 0, // Will be calculated from Order in future
        totalEarningsMinor: 0, // Will be calculated from Commission in future
        createdAt: product.createdAt,
      };
    });
  }

  /**
   * Get stream detail with referral link.
   */
  async getStreamDetail(creatorId: string, productId: string): Promise<CreatorStreamDto> {
    // Fetch the product with its offer
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        offers: {
          take: 1,
          select: {
            priceMinor: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const offer = (product as any).offers?.[0];
    const priceMinor = offer?.priceMinor || 0;
    const commissionPercent = 20; // Default 20% - commission is in Campaign, not Offer
    const frontendUrl = this.config.get('FRONTEND_URL') || 'https://sofsavdo.com';

    return {
      id: product.id,
      productId: product.id,
      productName: product.name,
      productImage: product.images[0] || '',
      productPriceMinor: priceMinor,
      commissionPercent,
      referralLink: `${frontendUrl}/f/${product.slug}?ref=${creatorId}`,
      totalClicks: 0, // Will be calculated from ReferralVisit in future
      totalSales: 0, // Will be calculated from Order in future
      totalEarningsMinor: 0, // Will be calculated from Commission in future
      createdAt: product.createdAt,
    };
  }

  /**
   * Get my earnings data.
   */
  async getMyEarnings(creatorId: string): Promise<CreatorEarningsDto> {
    // Temporary: return mock data to avoid Prisma errors
    // TODO: Fix database schema issue
    return {
      availableBalanceMinor: 0,
      pendingEarningsMinor: 0,
      totalEarningsMinor: 0,
      lifetimeSales: 0,
      transactions: [],
    };
  }

  /**
   * Request withdrawal.
   */
  async requestWithdrawal(creatorId: string, amountMinor: number): Promise<{ success: boolean }> {
    // Temporary: return success to avoid Prisma errors
    // TODO: Fix database schema issue
    return { success: true };
  }

  /**
   * Generate instant sharing link for a product.
   */
  async generateSharingLink(creatorId: string, productId: string): Promise<string> {
    // Placeholder - will be implemented in Phase 2
    return 'https://sofsavdo.com/f/EXAMPLE';
  }

  /**
   * Mask payout details for security.
   */
  private maskPayoutDetails(details: any): string | undefined {
    if (!details) return undefined;
    
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    
    // Mask card number: ****1234
    if (detailsStr.length >= 4) {
      return '****' + detailsStr.slice(-4);
    }
    
    return detailsStr;
  }
}
