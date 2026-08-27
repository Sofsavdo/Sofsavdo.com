import { createHmac, timingSafeEqual } from "node:crypto";

// Byte-for-byte the same scheme as fidem-click-token.util.ts — see that file's comments for the
// reasoning. Kept as a separate module (own prefix, own secret) rather than sharing Fidem's
// utility so a leaked secret on one partner integration never compromises the other.
const TOKEN_PREFIX = "iz";
// Matches Flow's own referral-cookie attribution window (see referral.controller.ts) — a click
// on a creator's Izdosh link should count for as long as a click on a normal product link does.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

// Opaque, URL-safe token binding a Flow click to Izdosh. Stateless by design — no DB row to mint,
// look up, or expire: the embedded expiry and signature are the only source of truth, re-verified
// from scratch when Izdosh's webhook reports the resulting conversion. Izdosh never needs to
// parse this — it just stores whatever string it received in the `ref` query param and echoes it
// back verbatim in the webhook payload.
export function signIzdoshClickToken(flowId: string, secret: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = sign(`${flowId}.${expiresAt}`, secret);
  return `${TOKEN_PREFIX}_${flowId}_${expiresAt}_${signature}`;
}

export function verifyIzdoshClickToken(token: string, secret: string): { flowId: string } | null {
  const parts = token.split("_");
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return null;
  const [, flowId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!flowId || !signature || !Number.isFinite(expiresAt)) return null;
  if (Math.floor(Date.now() / 1000) > expiresAt) return null;

  const expected = sign(`${flowId}.${expiresAt}`, secret);
  const actual = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actual.length !== expectedBuf.length || !timingSafeEqual(actual, expectedBuf)) return null;

  return { flowId };
}

// The webhook payload's own `signature` field authenticates the whole conversion report — same
// shape as Fidem's (and Click's callback): a signature that is itself a field of the payload,
// over specific known values, so no raw-body middleware is needed for this route.
export function signIzdoshWebhookPayload(clickToken: string, externalPaymentId: string, amountMinor: number, commissionAmountMinor: number, occurredAt: string, secret: string): string {
  return sign(`${clickToken}.${externalPaymentId}.${amountMinor}.${commissionAmountMinor}.${occurredAt}`, secret);
}

export function verifyIzdoshWebhookSignature(clickToken: string, externalPaymentId: string, amountMinor: number, commissionAmountMinor: number, occurredAt: string, signature: string, secret: string): boolean {
  const expected = signIzdoshWebhookPayload(clickToken, externalPaymentId, amountMinor, commissionAmountMinor, occurredAt, secret);
  const actual = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}
