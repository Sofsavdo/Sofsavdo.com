import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainException } from "../common/errors/domain-error";
import { soumToMinor } from "../common/money/money";
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallbackAction,
  PaymentCallbackReply,
  PaymentPort,
  VerifiedPaymentCallback,
} from "./payment.port";

// Click.uz's real Merchant API "Prepare"/"Complete" callback contract (their published
// integration docs — this is the standard two-phase protocol every Click merchant implements,
// not something specific to this codebase). Click POSTs form-encoded fields to our callback URL
// twice per transaction: once with action=0 (Prepare, before it takes the customer's money) and
// once with action=1 (Complete, after). We must verify the MD5 signature on every call and never
// treat an unverified payload as evidence of payment (spec: "never trust client requests").
interface ClickCallbackFields {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  ALREADY_PAID: -4,
  TRANSACTION_NOT_FOUND: -5,
  TRANSACTION_CANCELLED: -9,
} as const;

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

@Injectable()
export class ClickPaymentAdapter implements PaymentPort {
  readonly provider = "CLICK";

  private readonly merchantId: string;
  private readonly serviceId: string;
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.merchantId = this.config.get<string>("payments.click.merchantId") ?? "";
    this.serviceId = this.config.get<string>("payments.click.serviceId") ?? "";
    this.secretKey = this.config.get<string>("payments.click.secretKey") ?? "";
  }

  // "Pay via URL" — Click's simplest integration path: redirect the customer to a URL carrying
  // the amount and our transaction_param (our Payment.id); Click itself hosts the card-entry page
  // and later calls our Prepare/Complete callback. No card data ever touches our backend.
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const amountSoum = (request.amountMinor / 100).toFixed(2);
    const params = new URLSearchParams({
      service_id: this.serviceId,
      merchant_id: this.merchantId,
      amount: amountSoum,
      transaction_param: request.paymentId,
      return_url: request.returnUrl,
    });
    return Promise.resolve({ redirectUrl: `https://my.click.uz/services/pay?${params.toString()}` });
  }

  private computeSignature(fields: ClickCallbackFields): string {
    // Prepare (action=0): md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
    // Complete (action=1): md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
    const parts =
      fields.action === "1"
        ? [fields.click_trans_id, fields.service_id, this.secretKey, fields.merchant_trans_id, fields.merchant_prepare_id ?? "", fields.amount, fields.action, fields.sign_time]
        : [fields.click_trans_id, fields.service_id, this.secretKey, fields.merchant_trans_id, fields.amount, fields.action, fields.sign_time];
    return createHash("md5").update(parts.join("")).digest("hex");
  }

  verifyCallback(rawBody: Record<string, unknown>): VerifiedPaymentCallback {
    const fields: ClickCallbackFields = {
      click_trans_id: asString(rawBody.click_trans_id),
      service_id: asString(rawBody.service_id),
      merchant_trans_id: asString(rawBody.merchant_trans_id),
      merchant_prepare_id: rawBody.merchant_prepare_id != null ? asString(rawBody.merchant_prepare_id) : undefined,
      amount: asString(rawBody.amount),
      action: asString(rawBody.action),
      error: asString(rawBody.error),
      error_note: asString(rawBody.error_note),
      sign_time: asString(rawBody.sign_time),
      sign_string: asString(rawBody.sign_string),
    };

    if (!fields.click_trans_id || !fields.merchant_trans_id || !fields.sign_string) {
      throw new DomainException("INVALID_PAYMENT_SIGNATURE", "Click so'rovida majburiy maydonlar yetishmayapti.");
    }

    const expectedSignature = this.computeSignature(fields);
    if (expectedSignature !== fields.sign_string) {
      throw new DomainException("INVALID_PAYMENT_SIGNATURE", "Click imzosi noto'g'ri.");
    }

    const errorCode = Number(fields.error || "0");

    return {
      action: fields.action === "1" ? "COMPLETE" : "PREPARE",
      paymentId: fields.merchant_trans_id,
      providerTransactionId: fields.click_trans_id,
      amountMinor: soumToMinor(Number(fields.amount)),
      errorCode: errorCode !== 0 ? errorCode : null,
      errorNote: errorCode !== 0 ? fields.error_note : null,
    };
  }

  buildCallbackReply(
    action: PaymentCallbackAction,
    rawBody: Record<string, unknown>,
    result: { ok: true; internalId: string } | { ok: false; errorCode: number; errorNote: string },
  ): PaymentCallbackReply {
    const common = {
      click_trans_id: asString(rawBody.click_trans_id),
      merchant_trans_id: asString(rawBody.merchant_trans_id),
    };
    if (!result.ok) {
      return { httpStatus: 200, body: { ...common, error: result.errorCode, error_note: result.errorNote } };
    }
    if (action === "PREPARE") {
      return {
        httpStatus: 200,
        body: { ...common, merchant_prepare_id: result.internalId, error: CLICK_ERROR.SUCCESS, error_note: "Success" },
      };
    }
    return {
      httpStatus: 200,
      body: { ...common, merchant_confirm_id: result.internalId, error: CLICK_ERROR.SUCCESS, error_note: "Success" },
    };
  }
}

export { CLICK_ERROR };
