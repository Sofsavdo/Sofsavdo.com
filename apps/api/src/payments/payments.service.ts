import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma, PaymentProviderType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { PAYMENT_PORT_REGISTRY, type PaymentPort } from "./payment.port";

export interface InitiatePaymentResult {
  paymentId: string;
  redirectUrl: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private orders: OrdersService,
    private audit: AuditService,
    @Inject(PAYMENT_PORT_REGISTRY) private paymentPorts: Map<PaymentProviderType, PaymentPort>,
  ) {}

  // Idempotent: a retried checkout call (same Order, same provider) reuses the existing Payment
  // row and just recomputes the (stateless, deterministic) redirect rather than creating a second
  // Payment — Payment.orderId is @unique, so a naive create() would fail anyway, but this makes
  // the intended behavior explicit rather than relying on a DB error to surface it.
  //
  // Phase F: looks the provider up in the registry instead of a hardcoded `if (provider ===
  // "CLICK")` — Cash-on-Delivery now goes through the exact same path as Click, proving the
  // registry actually works for more than the one provider it replaced. MANUAL (Pay Later)
  // deliberately has no registered adapter at all — there is no payment processing to initiate,
  // only a human review step, so `paymentPorts.get("MANUAL")` correctly returns undefined and no
  // redirect is built.
  async initiatePayment(orderId: string, provider: PaymentProviderType): Promise<InitiatePaymentResult> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    let payment = await this.prisma.payment.findUnique({ where: { orderId } });

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId,
          provider,
          status: "PENDING",
          amountMinor: order.totalMinor,
          currency: order.currency,
          idempotencyKey: `${orderId}:payment`,
          webhookPayloads: [],
        },
      });
    }

    let redirectUrl: string | null = null;
    const port = this.paymentPorts.get(provider);
    if (port) {
      const result = await port.createPayment({
        paymentId: payment.id,
        amountMinor: order.totalMinor,
        currency: order.currency,
        returnUrl: `${this.config.get<string>("webAppUrl")}/order-success/${order.publicToken}`,
      });
      redirectUrl = result.redirectUrl;
    }
    // MANUAL (Pay Later): no registered adapter, no redirect — the customer is told an admin will
    // review the order.

    if (order.status === "CREATED") {
      await this.orders.transitionStatus(orderId, "PAYMENT_PENDING", null, provider === "MANUAL" ? "To'lovni keyinga qoldirish so'ralgan." : undefined);
    }
    await this.audit.record({ actorId: null, action: "PAYMENT_STARTED", entityType: "Order", entityId: orderId, after: { provider, paymentId: payment.id } });

    return { paymentId: payment.id, redirectUrl };
  }

  // ---- Click callback (Prepare/Complete) ----

  async handleClickCallback(rawBody: Record<string, unknown>) {
    // Hardcoding the "CLICK" lookup here is honest, not a workaround: this method only ever
    // exists because Click itself calls it (see ClickCallbackController) — a future Payme/Uzum
    // Nasiya callback would get its own equally provider-specific handleXCallback method, not a
    // generalized one, since each provider's callback contract is genuinely different.
    // verifyCallback throws DomainException("INVALID_PAYMENT_SIGNATURE") on a bad/missing
    // signature — the callback controller is responsible for translating that into Click's own
    // error-reply shape rather than letting it become a generic HTTP error Click can't parse.
    const verified = this.paymentPorts.get("CLICK")!.verifyCallback(rawBody);

    const payment = await this.prisma.payment.findUnique({ where: { id: verified.paymentId } });
    if (!payment) throw new DomainException("PAYMENT_NOT_FOUND", "To'lov topilmadi.");

    if (verified.amountMinor !== payment.amountMinor) {
      throw new DomainException("INVALID_PAYMENT_AMOUNT", "To'lov summasi mos kelmadi.");
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { webhookPayloads: { push: rawBody as Prisma.InputJsonValue } } });

    // Replay protection: a terminal Payment has already been fully processed — Click is known to
    // retry callbacks, so re-acknowledge without reprocessing rather than erroring (which would
    // make Click retry forever) or double-firing the PAID side effects (OrdersService.markPaid is
    // separately idempotent-guarded too, as defense in depth).
    if (payment.status === "PAID" || payment.status === "FAILED") {
      return { verified, alreadyProcessed: true };
    }

    if (verified.errorCode != null) {
      // Phase 14 fix: Payment.status and the Order's CANCELLED transition used to be two separate,
      // un-transacted writes (this one, then a second one inside markPaymentFailed) — a process
      // crash between them could leave Payment showing FAILED while the Order stayed
      // PAYMENT_PENDING forever. markPaymentFailed now sets both inside its own single
      // transaction; providerReference is passed through instead of written here first.
      await this.orders.markPaymentFailed(payment.orderId, verified.errorNote ?? `Click error ${verified.errorCode}`, verified.providerTransactionId);
      return { verified, alreadyProcessed: false };
    }

    if (verified.action === "PREPARE") {
      // PREPARE never transitions the Order — there is no corresponding Order-side write to be
      // atomic with, so a direct Payment update (metadata only, no status change) is correct here.
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerReference: verified.providerTransactionId } });
      return { verified, alreadyProcessed: false };
    }

    // COMPLETE, no error — the payment succeeded. Same atomicity fix as the FAILED branch above:
    // markPaid sets Payment.status=PAID and the Order's PAID transition inside one transaction.
    await this.orders.markPaid(payment.orderId, null, undefined, verified.providerTransactionId);
    return { verified, alreadyProcessed: false };
  }
}
