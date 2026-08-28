import { signIzdoshClickToken, signIzdoshWebhookPayload, verifyIzdoshClickToken, verifyIzdoshWebhookSignature } from "./izdosh-click-token.util";

describe("izdosh-click-token.util", () => {
  const secret = "test-secret";

  describe("signIzdoshClickToken / verifyIzdoshClickToken", () => {
    it("round-trips a valid token back to its flowId", () => {
      const token = signIzdoshClickToken("flow123", secret);
      expect(token).toMatch(/^iz_flow123_\d+_[0-9a-f]{16}$/);
      expect(verifyIzdoshClickToken(token, secret)).toEqual({ flowId: "flow123" });
    });

    it("rejects a token signed with a different secret", () => {
      const token = signIzdoshClickToken("flow123", secret);
      expect(verifyIzdoshClickToken(token, "wrong-secret")).toBeNull();
    });

    it("rejects an expired token", () => {
      const token = signIzdoshClickToken("flow123", secret, -1);
      expect(verifyIzdoshClickToken(token, secret)).toBeNull();
    });

    it("rejects a tampered flowId even if the rest of the token is untouched", () => {
      const token = signIzdoshClickToken("flow123", secret);
      const tampered = token.replace("flow123", "flow456");
      expect(verifyIzdoshClickToken(tampered, secret)).toBeNull();
    });

    it("rejects a malformed token", () => {
      expect(verifyIzdoshClickToken("not-a-real-token", secret)).toBeNull();
      expect(verifyIzdoshClickToken("iz_only_three_parts", secret)).toBeNull();
    });
  });

  describe("signIzdoshWebhookPayload / verifyIzdoshWebhookSignature", () => {
    it("verifies a signature computed over the same fields", () => {
      const sig = signIzdoshWebhookPayload("iz_flow123_1_abc", "txn_1", 50000, 2500, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyIzdoshWebhookSignature("iz_flow123_1_abc", "txn_1", 50000, 2500, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(true);
    });

    it("rejects a signature if any field changes", () => {
      const sig = signIzdoshWebhookPayload("iz_flow123_1_abc", "txn_1", 50000, 2500, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyIzdoshWebhookSignature("iz_flow123_1_abc", "txn_1", 99999, 2500, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(false);
    });

    it("rejects a signature if the commissionAmountMinor field changes", () => {
      const sig = signIzdoshWebhookPayload("iz_flow123_1_abc", "txn_1", 50000, 2500, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyIzdoshWebhookSignature("iz_flow123_1_abc", "txn_1", 50000, 4900, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(false);
    });
  });
});
