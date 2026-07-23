import { createHash } from "node:crypto";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ClickPaymentAdapter } from "./click-payment.adapter";

function sign(parts: string[]): string {
  return createHash("md5").update(parts.join("")).digest("hex");
}

describe("ClickPaymentAdapter", () => {
  let adapter: ClickPaymentAdapter;
  const SECRET = "test-secret";
  const config = {
    get: (key: string) =>
      ({
        "payments.click.merchantId": "1001",
        "payments.click.serviceId": "2002",
        "payments.click.secretKey": SECRET,
      })[key],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ClickPaymentAdapter, { provide: ConfigService, useValue: config }],
    }).compile();
    adapter = moduleRef.get(ClickPaymentAdapter);
  });

  describe("createPayment", () => {
    it("builds a my.click.uz pay-via-URL redirect carrying amount and transaction_param", async () => {
      const result = await adapter.createPayment({ paymentId: "pay1", amountMinor: 150_000_00, currency: "UZS", returnUrl: "https://rosti.uz/order-success/abc" });
      const url = new URL(result.redirectUrl);
      expect(url.origin + url.pathname).toBe("https://my.click.uz/services/pay");
      expect(url.searchParams.get("service_id")).toBe("2002");
      expect(url.searchParams.get("merchant_id")).toBe("1001");
      expect(url.searchParams.get("amount")).toBe("150000.00");
      expect(url.searchParams.get("transaction_param")).toBe("pay1");
    });
  });

  describe("verifyCallback", () => {
    it("accepts a correctly signed PREPARE (action=0) callback", () => {
      const fields = { click_trans_id: "555", service_id: "2002", merchant_trans_id: "pay1", amount: "150000.00", action: "0", sign_time: "2026-07-22 10:00:00" };
      const sign_string = sign([fields.click_trans_id, fields.service_id, SECRET, fields.merchant_trans_id, fields.amount, fields.action, fields.sign_time]);
      const result = adapter.verifyCallback({ ...fields, error: "0", error_note: "Success", sign_string });
      expect(result).toMatchObject({ action: "PREPARE", paymentId: "pay1", providerTransactionId: "555", amountMinor: 150_000_00, errorCode: null });
    });

    it("accepts a correctly signed COMPLETE (action=1) callback, which includes merchant_prepare_id in the signature", () => {
      const fields = {
        click_trans_id: "555",
        service_id: "2002",
        merchant_trans_id: "pay1",
        merchant_prepare_id: "pay1",
        amount: "150000.00",
        action: "1",
        sign_time: "2026-07-22 10:00:05",
      };
      const sign_string = sign([
        fields.click_trans_id,
        fields.service_id,
        SECRET,
        fields.merchant_trans_id,
        fields.merchant_prepare_id,
        fields.amount,
        fields.action,
        fields.sign_time,
      ]);
      const result = adapter.verifyCallback({ ...fields, error: "0", error_note: "Success", sign_string });
      expect(result).toMatchObject({ action: "COMPLETE", paymentId: "pay1", providerTransactionId: "555" });
    });

    it("rejects a callback with a tampered/wrong signature", () => {
      expect(() =>
        adapter.verifyCallback({
          click_trans_id: "555",
          service_id: "2002",
          merchant_trans_id: "pay1",
          amount: "150000.00",
          action: "0",
          sign_time: "2026-07-22 10:00:00",
          error: "0",
          error_note: "Success",
          sign_string: "0000deadbeef0000",
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_PAYMENT_SIGNATURE" }));
    });

    it("rejects a callback missing required fields before even checking the signature", () => {
      expect(() => adapter.verifyCallback({ amount: "100.00" })).toThrow(expect.objectContaining({ code: "INVALID_PAYMENT_SIGNATURE" }));
    });

    it("surfaces a provider-reported error via errorCode/errorNote", () => {
      const fields = { click_trans_id: "555", service_id: "2002", merchant_trans_id: "pay1", amount: "150000.00", action: "1", sign_time: "2026-07-22 10:00:05" };
      const sign_string = sign([fields.click_trans_id, fields.service_id, SECRET, fields.merchant_trans_id, "", fields.amount, fields.action, fields.sign_time]);
      const result = adapter.verifyCallback({ ...fields, error: "-9", error_note: "Transaction cancelled", sign_string });
      expect(result.errorCode).toBe(-9);
      expect(result.errorNote).toBe("Transaction cancelled");
    });
  });

  describe("buildCallbackReply", () => {
    it("echoes click_trans_id/merchant_trans_id and includes merchant_prepare_id on a successful PREPARE reply", () => {
      const reply = adapter.buildCallbackReply("PREPARE", { click_trans_id: "555", merchant_trans_id: "pay1" }, { ok: true, internalId: "pay1" });
      expect(reply.httpStatus).toBe(200);
      expect(reply.body).toMatchObject({ click_trans_id: "555", merchant_trans_id: "pay1", merchant_prepare_id: "pay1", error: 0 });
    });

    it("includes merchant_confirm_id on a successful COMPLETE reply", () => {
      const reply = adapter.buildCallbackReply("COMPLETE", { click_trans_id: "555", merchant_trans_id: "pay1" }, { ok: true, internalId: "pay1" });
      expect(reply.body).toMatchObject({ merchant_confirm_id: "pay1", error: 0 });
    });

    it("reports a non-zero error code on failure without merchant_prepare_id/merchant_confirm_id", () => {
      const reply = adapter.buildCallbackReply("COMPLETE", { click_trans_id: "555", merchant_trans_id: "pay1" }, { ok: false, errorCode: -5, errorNote: "Not found" });
      expect(reply.body).toMatchObject({ error: -5, error_note: "Not found" });
      expect(reply.body.merchant_confirm_id).toBeUndefined();
    });
  });
});
