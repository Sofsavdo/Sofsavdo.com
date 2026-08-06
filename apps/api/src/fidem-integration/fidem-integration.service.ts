import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { applyBasisPoints } from "../common/money/money";
import { signFidemClickToken, verifyFidemClickToken, verifyFidemWebhookSignature } from "./fidem-click-token.util";
import type { FidemWebhookDto } from "./dto/fidem-webhook.dto";

@Injectable()
export class FidemIntegrationService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private requireSecret(): string {
    const secret = this.config.get<string>("fidem.integrationSecret");
    if (!secret) throw new DomainException("FIDEM_NOT_CONFIGURED", "Fidem integratsiyasi sozlanmagan.");
    return secret;
  }

  // Mints the click token appended to a Flow redirect toward Fidem's Telegram bot — see
  // ReferralController.handleReferral, the only caller.
  signClickToken(flowId: string): string {
    return signFidemClickToken(flowId, this.requireSecret());
  }

  // Fidem calls this when a user who arrived via a Sofsavdo Flow link completes a paid
  // conversion. Idempotent on externalPaymentId — Fidem is free to retry a delivery it isn't sure
  // landed without ever double-crediting a creator.
  async recordConversion(dto: FidemWebhookDto): Promise<{ status: "created" | "duplicate" }> {
    const secret = this.requireSecret();

    const validSignature = verifyFidemWebhookSignature(dto.clickToken, dto.externalPaymentId, dto.amountMinor, dto.occurredAt, dto.signature, secret);
    if (!validSignature) {
      throw new DomainException("INVALID_FIDEM_SIGNATURE", "Imzo noto'g'ri.");
    }

    const verifiedToken = verifyFidemClickToken(dto.clickToken, secret);
    if (!verifiedToken) {
      throw new DomainException("INVALID_CLICK_TOKEN", "Click token yaroqsiz yoki muddati o'tgan.");
    }

    // Duplicate delivery of an already-recorded conversion — succeed as a no-op rather than
    // erroring, so Fidem's retry logic doesn't need to special-case "already processed".
    const existing = await this.prisma.commission.findUnique({ where: { externalRef: dto.externalPaymentId } });
    if (existing) return { status: "duplicate" };

    const flow = await this.prisma.flow.findUnique({
      where: { id: verifiedToken.flowId },
      include: {
        product: {
          select: { id: true, name: true, commissionType: true, commissionRateBps: true, commissionAmountMinor: true, externalRedirectUrl: true },
        },
      },
    });
    if (!flow || flow.status !== "ACTIVE" || !flow.product.externalRedirectUrl) {
      throw new DomainException("FLOW_NOT_FOUND", "Flow topilmadi yoki faol emas.");
    }

    const baseAmountMinor = dto.amountMinor;
    let amountMinor = 0;
    if (flow.product.commissionType === "PERCENTAGE") {
      amountMinor = applyBasisPoints(baseAmountMinor, flow.product.commissionRateBps ?? 0);
    } else if (flow.product.commissionType === "FIXED_AMOUNT") {
      amountMinor = flow.product.commissionAmountMinor ?? 0;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.commission.create({
        data: {
          creatorId: flow.creatorProfileId,
          source: "EXTERNAL",
          externalRef: dto.externalPaymentId,
          externalDescription: dto.planName ? `Fidem — ${dto.planName}` : `Fidem — ${flow.product.name}`,
          baseAmountMinor,
          amountMinor,
          currency: dto.currency ?? "UZS",
          status: "PENDING",
        },
      });
      await tx.flow.update({ where: { id: flow.id }, data: { commissionEarnedMinor: { increment: amountMinor } } });
    });

    return { status: "created" };
  }
}
