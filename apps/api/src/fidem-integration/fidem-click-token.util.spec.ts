import { signFidemClickToken, signFidemWebhookPayload, verifyFidemClickToken, verifyFidemWebhookSignature } from "./fidem-click-token.util";

describe("fidem-click-token.util", () => {
  const secret = "test-secret";

  describe("signFidemClickToken / verifyFidemClickToken", () => {
    it("round-trips a valid token back to its flowId", () => {
      const token = signFidemClickToken("flow123", secret);
      expect(token).toMatch(/^sf_flow123_\d+_[0-9a-f]{16}$/);
      expect(verifyFidemClickToken(token, secret)).toEqual({ flowId: "flow123" });
    });

    it("rejects a token signed with a different secret", () => {
      const token = signFidemClickToken("flow123", secret);
      expect(verifyFidemClickToken(token, "wrong-secret")).toBeNull();
    });

    it("rejects an expired token", () => {
      const token = signFidemClickToken("flow123", secret, -1);
      expect(verifyFidemClickToken(token, secret)).toBeNull();
    });

    it("rejects a tampered flowId even if the rest of the token is untouched", () => {
      const token = signFidemClickToken("flow123", secret);
      const tampered = token.replace("flow123", "flow456");
      expect(verifyFidemClickToken(tampered, secret)).toBeNull();
    });

    it("rejects a malformed token", () => {
      expect(verifyFidemClickToken("not-a-real-token", secret)).toBeNull();
      expect(verifyFidemClickToken("sf_only_three_parts", secret)).toBeNull();
    });
  });

  describe("signFidemWebhookPayload / verifyFidemWebhookSignature", () => {
    it("verifies a signature computed over the same fields", () => {
      const sig = signFidemWebhookPayload("sf_flow123_1_abc", "txn_1", 50000, 25000, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyFidemWebhookSignature("sf_flow123_1_abc", "txn_1", 50000, 25000, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(true);
    });

    it("rejects a signature if any field changes", () => {
      const sig = signFidemWebhookPayload("sf_flow123_1_abc", "txn_1", 50000, 25000, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyFidemWebhookSignature("sf_flow123_1_abc", "txn_1", 99999, 25000, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(false);
    });

    it("rejects a signature if the commissionAmountMinor field changes", () => {
      const sig = signFidemWebhookPayload("sf_flow123_1_abc", "txn_1", 50000, 25000, "2026-01-01T00:00:00.000Z", secret);
      expect(verifyFidemWebhookSignature("sf_flow123_1_abc", "txn_1", 50000, 49900, "2026-01-01T00:00:00.000Z", sig, secret)).toBe(false);
    });
  });
});
