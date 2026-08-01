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
  constructor(private prisma: PrismaService) {}

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
   */
  async getMyStreams(creatorId: string): Promise<CreatorStreamDto[]> {
    // Get all referral links for this creator
    const referralLinks = await this.prisma.referralLink.findMany({
      where: { creatorId },
      include: {
        offer: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate stats for each referral link
    const streams = await Promise.all(
      referralLinks.map(async (referralLink) => {
        const referralVisits = await this.prisma.referralVisit.findMany({
          where: { referralLinkId: referralLink.id },
        });

        const totalClicks = referralVisits.length;
        
        // Get orders attributed to this referral link
        const orders = await this.prisma.order.findMany({
          where: {
            referralLinkId: referralLink.id,
            status: 'PAID',
          },
        });

        const totalSales = orders.length;
        
        // Calculate total earnings from commissions
        const commissions = await this.prisma.commission.findMany({
          where: {
            referralLinkId: referralLink.id,
            status: 'PAID',
          },
        });

        const totalEarningsMinor = commissions.reduce((sum, c) => sum + c.amountMinor, 0);

        return {
          id: referralLink.id,
          productId: referralLink.offer.product.id,
          productName: referralLink.offer.product.name,
          productImage: referralLink.offer.product.images[0] || '',
          productPriceMinor: referralLink.offer.priceMinor,
          commissionPercent: 0, // Will be calculated from campaign
          referralLink: `${process.env.FRONTEND_URL}/buyer/v2/f/${referralLink.code}`,
          totalClicks,
          totalSales,
          totalEarningsMinor,
          createdAt: referralLink.createdAt,
        };
      })
    );

    return streams;
  }

  /**
   * Get stream detail with referral link.
   */
  async getStreamDetail(creatorId: string, productId: string): Promise<CreatorStreamDto> {
    // Find referral link for this product and creator
    const referralLink = await this.prisma.referralLink.findFirst({
      where: {
        creatorId,
        offer: {
          productId,
        },
      },
      include: {
        offer: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!referralLink) {
      throw new Error('Stream not found');
    }

    const referralVisits = await this.prisma.referralVisit.findMany({
      where: { referralLinkId: referralLink.id },
    });

    const totalClicks = referralVisits.length;
    
    const orders = await this.prisma.order.findMany({
      where: {
        referralLinkId: referralLink.id,
        status: 'PAID',
      },
    });

    const totalSales = orders.length;
    
    const commissions = await this.prisma.commission.findMany({
      where: {
        referralLinkId: referralLink.id,
        status: 'PAID',
      },
    });

    const totalEarningsMinor = commissions.reduce((sum, c) => sum + c.amountMinor, 0);

    return {
      id: referralLink.id,
      productId: referralLink.offer.product.id,
      productName: referralLink.offer.product.name,
      productImage: referralLink.offer.product.images[0] || '',
      productPriceMinor: referralLink.offer.priceMinor,
      commissionPercent: 0,
      referralLink: `${process.env.FRONTEND_URL}/buyer/v2/f/${referralLink.code}`,
      totalClicks,
      totalSales,
      totalEarningsMinor,
      createdAt: referralLink.createdAt,
    };
  }

  /**
   * Get my earnings data.
   */
  async getMyEarnings(creatorId: string): Promise<CreatorEarningsDto> {
    // Get all commissions for this creator
    const paidCommissions = await this.prisma.commission.findMany({
      where: {
        creatorId,
        status: 'PAID',
      },
    });

    const pendingCommissions = await this.prisma.commission.findMany({
      where: {
        creatorId,
        status: 'PENDING',
      },
    });

    const availableBalanceMinor = paidCommissions.reduce((sum, c) => sum + c.amountMinor, 0);
    const pendingEarningsMinor = pendingCommissions.reduce((sum, c) => sum + c.amountMinor, 0);
    const totalEarningsMinor = availableBalanceMinor + pendingEarningsMinor;

    // Get lifetime sales count
    const orders = await this.prisma.order.findMany({
      where: {
        referralLink: {
          creatorId,
        },
        status: 'PAID',
      },
    });

    const lifetimeSales = orders.length;

    // Get recent transactions (commissions and payouts)
    const recentCommissions = await this.prisma.commission.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentPayouts = await this.prisma.payout.findMany({
      where: { creatorId },
      orderBy: { requestedAt: 'desc' },
      take: 5,
    });

    const transactions = [
      ...recentCommissions.map((c) => ({
        id: c.id,
        type: 'sale' as const,
        amountMinor: c.amountMinor,
        description: `Commission from order`,
        date: c.createdAt.toISOString(),
      })),
      ...recentPayouts.map((p) => ({
        id: p.id,
        type: 'withdrawal' as const,
        amountMinor: -p.amountMinor,
        description: `Withdrawal`,
        date: p.requestedAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    return {
      availableBalanceMinor,
      pendingEarningsMinor,
      totalEarningsMinor,
      lifetimeSales,
      transactions,
    };
  }

  /**
   * Request withdrawal.
   */
  async requestWithdrawal(creatorId: string, amountMinor: number): Promise<{ success: boolean }> {
    // Check if creator has enough balance
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      include: {
        commissions: {
          where: { status: 'PAID' },
        },
        payoutMethods: {
          where: { isDefault: true, isActive: true },
        },
      },
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    const availableBalance = creator.commissions.reduce((sum, c) => sum + c.amountMinor, 0);

    if (amountMinor > availableBalance) {
      throw new Error('Insufficient balance');
    }

    if (creator.payoutMethods.length === 0) {
      throw new Error('No payout method configured');
    }

    const payoutMethodId = creator.payoutMethods[0]?.id;
    if (!payoutMethodId) {
      throw new Error('No payout method configured');
    }

    // Create payout request
    await this.prisma.payout.create({
      data: {
        creatorId,
        amountMinor,
        status: 'REQUESTED',
        currency: 'UZS',
        payoutMethodId,
        requestedAt: new Date(),
      },
    });

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
