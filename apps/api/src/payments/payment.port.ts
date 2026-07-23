// Provider-independent payment boundary (Phase 8) — same convention as StoragePort/STORAGE_PORT.
// Domain code (CheckoutService, PaymentsService) depends only on this port, never on a concrete
// provider. Adding Payme/Uzum Nasiya later means adding one adapter class and changing the
// PaymentsModule binding — no domain-layer changes.
export const PAYMENT_PORT = Symbol("PAYMENT_PORT");

export interface CreatePaymentRequest {
  /** Our Payment.id — passed through to the provider as their merchant transaction reference. */
  paymentId: string;
  amountMinor: number;
  currency: string;
  /** Where the provider redirects the customer's browser after they finish paying. */
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** URL to redirect the customer's browser to in order to complete payment. */
  redirectUrl: string;
}

export type PaymentCallbackAction = "PREPARE" | "COMPLETE";

export interface VerifiedPaymentCallback {
  action: PaymentCallbackAction;
  /** Our Payment.id, extracted from the provider's merchant transaction reference. */
  paymentId: string;
  /** The provider's own transaction id — stored on Payment.providerReference for idempotency. */
  providerTransactionId: string;
  amountMinor: number;
  /** Non-null means the provider itself reported a failure for this transaction. */
  errorCode: number | null;
  errorNote: string | null;
}

export interface PaymentCallbackReply {
  httpStatus: number;
  body: Record<string, unknown>;
}

export interface PaymentPort {
  readonly provider: string;

  /** Build the redirect URL/session that starts a payment. Never charges anything itself. */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;

  /**
   * Verify an inbound provider callback's signature and required fields. Throws DomainException
   * ("INVALID_PAYMENT_SIGNATURE") if the signature doesn't check out — callers must never trust an
   * unverified payload as evidence of payment. Returns the parsed, verified callback on success.
   */
  verifyCallback(rawBody: Record<string, unknown>): VerifiedPaymentCallback;

  /** The exact response shape the provider's callback contract requires the merchant to return. */
  buildCallbackReply(
    action: PaymentCallbackAction,
    rawBody: Record<string, unknown>,
    result: { ok: true; internalId: string } | { ok: false; errorCode: number; errorNote: string },
  ): PaymentCallbackReply;
}
