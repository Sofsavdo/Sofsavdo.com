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

  it("createPayment returns a null redirectUrl — no external gateway to send the buyer to (see the adapter's own comment on why this must be null, not the returnUrl)", async () => {
    const result = await adapter.createPayment();
    expect(result.redirectUrl).toBeNull();
  });

  it("verifyCallback throws — nothing ever calls it, since COD has no inbound webhook", () => {
    expect(() => adapter.verifyCallback()).toThrow();
  });

  it("buildCallbackReply throws for the same reason", () => {
    expect(() => adapter.buildCallbackReply()).toThrow();
  });
});
