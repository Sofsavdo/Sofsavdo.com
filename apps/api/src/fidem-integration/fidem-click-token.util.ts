import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "sf";
// Matches Flow's own referral-cookie attribution window (see referral.controller.ts) — a click
// on a creator's Fidem link should count for as long as a click on a normal product link does.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  // 16 hex chars (64 bits) of the digest — plenty for a token whose only job is binding one click
  // to one Flow for 30 days, while keeping the whole token well under Telegram's 64-char start-
  // param limit ("sf_" + a ~25-char cuid + "_" + a 10-digit unix expiry + "_" + this = ~56 chars).
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
}

// Opaque, URL- and Telegram-start-param-safe token binding a Flow click to Fidem. Stateless by
// design — no DB row to mint, look up, or expire (unlike TelegramLinkToken): the embedded expiry
// and signature are the only source of truth, re-verified from scratch when Fidem's webhook
// reports the resulting conversion. Fidem never needs to parse this — it just stores whatever
// string it received at signup and echoes it back verbatim in the webhook payload.
export function signFidemClickToken(flowId: string, secret: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = sign(`${flowId}.${expiresAt}`, secret);
  return `${TOKEN_PREFIX}_${flowId}_${expiresAt}_${signature}`;
}

export function verifyFidemClickToken(token: string, secret: string): { flowId: string } | null {
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
// "signature is itself a field of the payload, over specific known values" shape as Click's
// callback (see ClickPaymentAdapter), chosen over a raw-request-body HMAC header so no raw-body
// middleware is needed for this one route.
export function signFidemWebhookPayload(clickToken: string, externalPaymentId: string, amountMinor: number, occurredAt: string, secret: string): string {
  return sign(`${clickToken}.${externalPaymentId}.${amountMinor}.${occurredAt}`, secret);
}

export function verifyFidemWebhookSignature(clickToken: string, externalPaymentId: string, amountMinor: number, occurredAt: string, signature: string, secret: string): boolean {
  const expected = signFidemWebhookPayload(clickToken, externalPaymentId, amountMinor, occurredAt, secret);
  const actual = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}
