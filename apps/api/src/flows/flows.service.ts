import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

// Product has no priceMinor of its own — price lives on its (hidden, internal) Offer. Every Flow
// read includes the product's one live offer so the creator-facing UI can show a real price
// without ever needing to know Offer exists as a separate concept.
const PRODUCT_WITH_ACTIVE_OFFER = {
  include: { offers: { where: { status: "ACTIVE" as const }, take: 1 } },
};

@Injectable()
export class FlowsService {
  constructor(private prisma: PrismaService) {}

  async createFlow(creatorProfileId: string, productId: string) {
    // Check if product exists and is ACTIVE
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new DomainException("NOT_FOUND", "Mahsulot topilmadi.");
    }

    if (product.status !== "ACTIVE") {
      throw new DomainException("INVALID_STATE", "Faqat ACTIVE mahsulotlar uchun Flow yaratish mumkin.");
    }

    // Check if flow already exists for this creator-product combination
    const existingFlow = await this.prisma.flow.findUnique({
      where: {
        creatorProfileId_productId: {
          creatorProfileId,
          productId,
        },
      },
      include: {
        product: PRODUCT_WITH_ACTIVE_OFFER,
        creatorProfile: true,
      },
    });

    if (existingFlow) {
      return existingFlow;
    }

    // Generate unique referral code
    const referralCode = await this.generateUniqueReferralCode();

    // Create flow
    const flow = await this.prisma.flow.create({
      data: {
        creatorProfileId,
        productId,
        referralCode,
        status: "ACTIVE",
      },
      include: {
        product: PRODUCT_WITH_ACTIVE_OFFER,
        creatorProfile: true,
      },
    });

    return flow;
  }

  async listFlows(creatorProfileId: string) {
    return this.prisma.flow.findMany({
      where: { creatorProfileId },
      include: {
        product: PRODUCT_WITH_ACTIVE_OFFER,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getFlowByReferralCode(referralCode: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { referralCode },
      include: {
        product: PRODUCT_WITH_ACTIVE_OFFER,
        creatorProfile: true,
      },
    });

    if (!flow) {
      throw new DomainException("NOT_FOUND", "Referral code topilmadi.");
    }

    if (flow.status !== "ACTIVE") {
      throw new DomainException("INVALID_STATE", "Bu referral code faol emas.");
    }

    // Increment click count
    await this.prisma.flow.update({
      where: { id: flow.id },
      data: { clickCount: { increment: 1 } },
    });

    return flow;
  }

  async pauseFlow(flowId: string, creatorProfileId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      throw new DomainException("NOT_FOUND", "Flow topilmadi.");
    }

    if (flow.creatorProfileId !== creatorProfileId) {
      throw new DomainException("FORBIDDEN", "Siz faqat o'zingizning Flowlaringizni boshqarishingiz mumkin.");
    }

    return this.prisma.flow.update({
      where: { id: flowId },
      data: { status: "PAUSED" },
    });
  }

  async activateFlow(flowId: string, creatorProfileId: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      throw new DomainException("NOT_FOUND", "Flow topilmadi.");
    }

    if (flow.creatorProfileId !== creatorProfileId) {
      throw new DomainException("FORBIDDEN", "Siz faqat o'zingizning Flowlaringizni boshqarishingiz mumkin.");
    }

    return this.prisma.flow.update({
      where: { id: flowId },
      data: { status: "ACTIVE" },
    });
  }

  private async generateUniqueReferralCode(): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;

      const existing = await this.prisma.flow.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }
    } while (attempts < maxAttempts);

    throw new DomainException("INTERNAL_ERROR", "Referral code generatsiya qilish imkonsiz.");
  }
}
