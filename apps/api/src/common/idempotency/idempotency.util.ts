import { randomUUID } from "node:crypto";

// Order creation and payment-webhook handling both need a caller-supplied idempotency key.
// This helper just validates shape; the actual dedupe check is a unique-constraint lookup inside
// each module's own transaction (OrdersService, PaymentsService), not here — idempotency is a
// per-write-path database concern, this module only centralizes the validation/generation shape.
export function isValidIdempotencyKey(key: string): boolean {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}

export function generateIdempotencyKey(): string {
  return randomUUID();
}
