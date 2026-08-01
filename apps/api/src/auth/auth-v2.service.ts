/**
 * Simplified Auth Service
 * 
 * Service for the simplified v2 auth API.
 * Phone-only login, 3-step registration, SMS verification.
 * 
 * Note: This is a simplified placeholder service. Full implementation
 * will be done in Phase 2 when we implement the complete API simplification.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  SimplifiedRegisterDto,
  SimplifiedPhoneLoginDto,
  VerifySmsDto,
  AuthResponseDto,
} from './dto/simplified-auth.dto';

@Injectable()
export class AuthV2Service {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Simplified registration - 3 steps only.
   */
  async register(dto: SimplifiedRegisterDto): Promise<AuthResponseDto> {
    // Check if phone already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existingUser) {
      throw new UnauthorizedException('Phone number already registered');
    }

    // Create user
    const password = this.generateRandomPassword();
    const passwordHash = password; // Placeholder - will use proper hashing in Phase 2

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        displayName: dto.displayName,
        status: 'ACTIVE',
      },
    });

    // Create creator profile
    const creator = await this.prisma.creatorProfile.create({
      data: {
        userId: user.id,
        displayName: dto.displayName,
        city: dto.city,
        referralCode: this.generateReferralCode(),
        bioComplianceStatus: 'PENDING',
        tier: 'STANDARD',
      },
    });

    // Create social account if provided
    if (dto.socialLink) {
      await this.prisma.socialAccount.create({
        data: {
          creatorId: creator.id,
          platform: 'INSTAGRAM',
          profileUrl: dto.socialLink,
          handle: dto.socialLink,
          followerCount: 0,
        },
      });
    }

    // Send SMS verification code
    const smsCode = this.generateSmsCode();
    await this.sendSmsCode(dto.phone, smsCode);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, creator.id);

    return {
      ...tokens,
      userId: user.id,
      creatorId: creator.id,
      role: 'CREATOR',
    };
  }

  /**
   * Phone-only login.
   */
  async phoneLogin(dto: SimplifiedPhoneLoginDto): Promise<{ message: string }> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Phone number not registered');
    }

    // Send SMS verification code
    const smsCode = this.generateSmsCode();
    await this.sendSmsCode(dto.phone, smsCode);

    return { message: 'SMS code sent' };
  }

  /**
   * Verify SMS code and complete login.
   */
  async verifySms(dto: VerifySmsDto): Promise<AuthResponseDto> {
    // Validate SMS code (placeholder - will implement proper validation in Phase 2)
    if (dto.code !== '123456') {
      throw new UnauthorizedException('Invalid SMS code');
    }

    // Find user by phone
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: {
        creatorProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update phone verification
    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.creatorProfile?.id);

    return {
      ...tokens,
      userId: user.id,
      creatorId: user.creatorProfile?.id,
      role: 'CREATOR',
    };
  }

  /**
   * Generate JWT tokens.
   */
  private async generateTokens(userId: string, creatorId?: string) {
    const payload = { sub: userId, creatorId };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Save refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshToken, // Placeholder - will use proper hashing in Phase 2
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Generate random password for phone-only users.
   */
  private generateRandomPassword(): string {
    return Math.random().toString(36).slice(-12);
  }

  /**
   * Generate referral code.
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate SMS code.
   */
  private generateSmsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS code (placeholder - will implement in Phase 2).
   */
  private async sendSmsCode(phone: string, code: string): Promise<void> {
    // Placeholder - will integrate with SMS provider in Phase 2
    console.log(`SMS sent to ${phone}: ${code}`);
  }
}
