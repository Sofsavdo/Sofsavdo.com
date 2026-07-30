import { Injectable } from "@nestjs/common";
import { DomainException } from "../common/errors/domain-error";
import type { CreatePaymentResult, PaymentCallbackReply, PaymentPort, VerifiedPaymentCallback } from "./payment.port";

// Cash on Delivery — the first adapter to prove the Phase F provider registry (PaymentsModule)
// actually works for more than one provider, not just Click. Deliberately the simplest possible
// real adapter: no external gateway, no callback, no signature to verify — the buyer pays the
// courier in person, and an admin marks the order PAID afterward through the existing
// admin order-status transition endpoint (OrdersService.adminUpdateStatus), the same "someone with
// real-world knowledge confirms it" pattern already used for MANUAL (Pay Later).
@Injectable()
export class CodPaymentAdapter implements PaymentPort {
  readonly provider = "CASH_ON_DELIVERY";

  // Nothing to redirect to — genuinely null, exactly like MANUAL (which has no registered adapter
  // at all and so never even reaches a redirectUrl assignment — see PaymentsService.initiatePayment).
  // Returning `request.returnUrl` here instead of `null` was a real, if minor, bug: the frontend
  // (CheckoutPageClient) branches on `paymentRedirectUrl` being truthy to decide between a full
  // `window.location.assign` (an external provider redirect) and an internal `router.push` (no
  // real redirect) — a non-null value here silently downgraded every COD checkout to the slower,
  // full-page-reload path even though there was never anywhere external to send the buyer. No
  // `await` inside: this adapter never calls out anywhere, unlike Click's real HTTP-facing one —
  // still async to satisfy PaymentPort's interface, which every adapter implements uniformly.
  // eslint-disable-next-line @typescript-eslint/require-await
  async createPayment(): Promise<CreatePaymentResult> {
    return { redirectUrl: null };
  }

  // COD has no inbound webhook of any kind — nothing ever calls this for a CASH_ON_DELIVERY
  // Payment. Throwing here (rather than silently returning something) means a future accidental
  // wiring mistake (e.g. routing a real callback at this adapter) fails loudly, not silently.
  verifyCallback(): VerifiedPaymentCallback {
    throw new DomainException("PAYMENT_METHOD_NOT_SUPPORTED", "Naqd to'lov uchun callback mavjud emas.");
  }

  buildCallbackReply(): PaymentCallbackReply {
    throw new DomainException("PAYMENT_METHOD_NOT_SUPPORTED", "Naqd to'lov uchun callback mavjud emas.");
  }
}
