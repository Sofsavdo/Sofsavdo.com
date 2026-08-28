import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { signIzdoshClickToken, verifyIzdoshClickToken, verifyIzdoshWebhookSignature } from "./izdosh-click-token.util";
import type { IzdoshWebhookDto } from "./dto/izdosh-webhook.dto";

// Byte-for-byte mirrors FidemIntegrationService — see that file's comments for the reasoning
// behind each check. The only real difference from Fidem's flow: Izdosh is a normal website, not
// a Telegram bot, so ReferralController appends the click token as `?ref=` instead of `?start=`.
@Injectable()
export class IzdoshIntegrationService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private requireSecret(): string {
    const secret = this.config.get<string>("izdosh.integrationSecret");
    if (!secret) throw new DomainException("IZDOSH_NOT_CONFIGURED", "Izdosh integratsiyasi sozlanmagan.");
    return secret;
  }

  // Mints the click token appended to a Flow redirect toward Izdosh — see
  // ReferralController.handleReferral, the only caller.
  signClickToken(flowId: string): string {
    return signIzdoshClickToken(flowId, this.requireSecret());
  }

  // Izdosh calls this when a user who arrived via a Sofsavdo Flow link completes a paid course
  // purchase. Idempotent on externalPaymentId — Izdosh is free to retry a delivery it isn't sure
  // landed without ever double-crediting a creator.
  async recordConversion(dto: IzdoshWebhookDto): Promise<{ status: "created" | "duplicate" }> {
    const secret = this.requireSecret();

    const validSignature = verifyIzdoshWebhookSignature(dto.clickToken, dto.externalPaymentId, dto.amountMinor, dto.commissionAmountMinor, dto.occurredAt, dto.signature, secret);
    if (!validSignature) {
      throw new DomainException("INVALID_IZDOSH_SIGNATURE", "Imzo noto'g'ri.");
    }

    // Izdosh computes the reward itself (5% of the sale price — see
    // lib/payments/sofsavdo-integration.ts) and reports the already-decided amount; Sofsavdo
    // never re-derives it from a generic product commission rate. This is only a sanity bound
    // against an implementation bug on either side, not the real authorization — the signature is.
    if (dto.commissionAmountMinor > dto.amountMinor) {
      throw new DomainException("INVALID_AMOUNT", "Komissiya to'lov summasidan katta bo'lishi mumkin emas.");
    }

    const verifiedToken = verifyIzdoshClickToken(dto.clickToken, secret);
    if (!verifiedToken) {
      throw new DomainException("INVALID_CLICK_TOKEN", "Click token yaroqsiz yoki muddati o'tgan.");
    }

    // Duplicate delivery of an already-recorded conversion — succeed as a no-op rather than
    // erroring, so Izdosh's retry logic doesn't need to special-case "already processed".
    const existing = await this.prisma.commission.findUnique({ where: { externalRef: dto.externalPaymentId } });
    if (existing) return { status: "duplicate" };

    const flow = await this.prisma.flow.findUnique({
      where: { id: verifiedToken.flowId },
      include: {
        product: { select: { id: true, name: true, externalRedirectUrl: true } },
      },
    });
    if (!flow || flow.status !== "ACTIVE" || !flow.product.externalRedirectUrl) {
      throw new DomainException("FLOW_NOT_FOUND", "Flow topilmadi yoki faol emas.");
    }

    const baseAmountMinor = dto.amountMinor;
    const amountMinor = dto.commissionAmountMinor;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.commission.create({
          data: {
            creatorId: flow.creatorProfileId,
            source: "EXTERNAL",
            externalRef: dto.externalPaymentId,
            externalDescription: dto.planName ? `Izdosh — ${dto.planName}` : `Izdosh — ${flow.product.name}`,
            baseAmountMinor,
            amountMinor,
            currency: dto.currency ?? "UZS",
            status: "PENDING",
          },
        });
        await tx.flow.update({ where: { id: flow.id }, data: { commissionEarnedMinor: { increment: amountMinor } } });
      });
    } catch (err) {
      // Same swallow-only-P2002 pattern as FidemIntegrationService.recordConversion — the
      // duplicate check above runs outside this transaction, so two near-simultaneous retries of
      // the same webhook delivery can both pass it before either commits; Commission.externalRef's
      // unique index still prevents a second row, but the losing request would otherwise see a
      // raw P2002 and return an unhandled 500 instead of the clean {status:"duplicate"} promised.
      if (err instanceof Object && "code" in err && (err as { code?: string }).code === "P2002") {
        return { status: "duplicate" };
      }
      throw err;
    }

    return { status: "created" };
  }
}
