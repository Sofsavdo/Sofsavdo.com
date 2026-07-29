import { Test } from "@nestjs/testing";
import { CodPaymentAdapter } from "./cod-payment.adapter";

describe("CodPaymentAdapter (Phase F)", () => {
  let adapter: CodPaymentAdapter;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [CodPaymentAdapter] }).compile();
    adapter = moduleRef.get(CodPaymentAdapter);
  });

  it("identifies itself as CASH_ON_DELIVERY", () => {
    expect(adapter.provider).toBe("CASH_ON_DELIVERY");
  });

  it("createPayment redirects straight to the given returnUrl — no external gateway to build a URL for", async () => {
    const result = await adapter.createPayment({
      paymentId: "payment1",
      amountMinor: 50_000_00,
      currency: "UZS",
      returnUrl: "https://sofsavdo.com/order-success/public-token-1",
    });
    expect(result.redirectUrl).toBe("https://sofsavdo.com/order-success/public-token-1");
  });

  it("verifyCallback throws — nothing ever calls it, since COD has no inbound webhook", () => {
    expect(() => adapter.verifyCallback()).toThrow();
  });

  it("buildCallbackReply throws for the same reason", () => {
    expect(() => adapter.buildCallbackReply()).toThrow();
  });
});
