import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { PAYMENT_PORT, type PaymentPort } from "./payment.port";

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
    @Inject(PAYMENT_PORT) private paymentPort: PaymentPort,
  ) {}

  // Idempotent: a retried checkout call (same Order, same provider) reuses the existing Payment
  // row and just recomputes the (stateless, deterministic) Click redirect URL rather than creating
  // a second Payment — Payment.orderId is @unique, so a naive create() would fail anyway, but this
  // makes the intended behavior explicit rather than relying on a DB error to surface it.
  async initiatePayment(orderId: string, provider: "CLICK" | "MANUAL"): Promise<InitiatePaymentResult> {
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
    if (provider === "CLICK") {
      const result = await this.paymentPort.createPayment({
        paymentId: payment.id,
        amountMinor: order.totalMinor,
        currency: order.currency,
        returnUrl: `${this.config.get<string>("webAppUrl")}/order-success/${order.publicToken}`,
      });
      redirectUrl = result.redirectUrl;
    }
    // MANUAL (Pay Later): no redirect — the customer is told an admin will review the order.

    if (order.status === "CREATED") {
      await this.orders.transitionStatus(orderId, "PAYMENT_PENDING", null, provider === "MANUAL" ? "To'lovni keyinga qoldirish so'ralgan." : undefined);
    }
    await this.audit.record({ actorId: null, action: "PAYMENT_STARTED", entityType: "Order", entityId: orderId, after: { provider, paymentId: payment.id } });

    return { paymentId: payment.id, redirectUrl };
  }

  // ---- Click callback (Prepare/Complete) ----

  async handleClickCallback(rawBody: Record<string, unknown>) {
    // verifyCallback throws DomainException("INVALID_PAYMENT_SIGNATURE") on a bad/missing
    // signature — the callback controller is responsible for translating that into Click's own
    // error-reply shape rather than letting it become a generic HTTP error Click can't parse.
    const verified = this.paymentPort.verifyCallback(rawBody);

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
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", providerReference: verified.providerTransactionId } });
      await this.orders.markPaymentFailed(payment.orderId, verified.errorNote ?? `Click error ${verified.errorCode}`);
      return { verified, alreadyProcessed: false };
    }

    if (verified.action === "PREPARE") {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerReference: verified.providerTransactionId } });
      return { verified, alreadyProcessed: false };
    }

    // COMPLETE, no error — the payment succeeded.
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID", providerReference: verified.providerTransactionId } });
    await this.orders.markPaid(payment.orderId);
    return { verified, alreadyProcessed: false };
  }
}
