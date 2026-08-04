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

  // A creator downloading a product photo to post on their own social media is exactly the
  // scenario a brand wants attributed back to it — a plain, unwatermarked file could be reposted
  // with the source stripped out entirely. Fetches the original from wherever it's actually
  // hosted (Supabase/S3/local — doesn't matter, images are always stored as full public URLs, see
  // uploads.service.ts) and overlays "sofsavdo.com" in the bottom-right corner before returning.
  async getWatermarkedProductImage(
    flowId: string,
    creatorProfileId: string,
    imageIndex: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const flow = await this.prisma.flow.findUnique({
      where: { id: flowId },
      include: { product: { select: { images: true } } },
    });

    if (!flow) throw new DomainException("NOT_FOUND", "Flow topilmadi.");
    if (flow.creatorProfileId !== creatorProfileId) {
      throw new DomainException("FORBIDDEN", "Siz faqat o'zingizning Flowlaringizni boshqarishingiz mumkin.");
    }
    const imageUrl = flow.product.images[imageIndex];
    if (!imageUrl) throw new DomainException("NOT_FOUND", "Rasm topilmadi.");

    const sourceRes = await fetch(imageUrl);
    if (!sourceRes.ok) throw new DomainException("NOT_FOUND", "Rasmni yuklab bo'lmadi.");
    const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
    const contentType = sourceRes.headers.get("content-type") ?? "image/jpeg";

    const sharp = (await import("sharp")).default;
    const image = sharp(sourceBuffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 1024;
    const fontSize = Math.max(18, Math.round(width * 0.035));
    const padding = Math.round(fontSize * 0.6);

    // A translucent pill behind the text so the watermark stays legible against any background
    // color/photo content, not just light or dark ones specifically.
    const label = "sofsavdo.com";
    const textWidthEstimate = label.length * fontSize * 0.62;
    const pillWidth = Math.round(textWidthEstimate + padding * 2);
    const pillHeight = Math.round(fontSize * 1.9);
    const svg = `
      <svg width="${width}" height="${height}">
        <rect x="${width - pillWidth - padding}" y="${height - pillHeight - padding}"
              width="${pillWidth}" height="${pillHeight}" rx="${pillHeight / 2}"
              fill="black" fill-opacity="0.45" />
        <text x="${width - padding - pillWidth / 2}" y="${height - padding - pillHeight / 2 + fontSize * 0.33}"
              font-family="DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="700"
              fill="white" text-anchor="middle">${label}</text>
      </svg>
    `;

    const watermarked = await image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
    return { buffer: watermarked, contentType };
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
