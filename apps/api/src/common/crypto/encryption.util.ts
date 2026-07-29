import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// AES-256-GCM, keyed by a config secret (never the plaintext key itself — scrypt-derived so a
// short/human-typed dev secret still yields a full-length key). Output is one string:
// `${ivHex}:${authTagHex}:${ciphertextHex}` — self-contained, no separate IV storage needed.
// Used only for PayoutMethod.cardNumberEnc (see schema comment) — bankAccount/cardHolder/bankName
// are stored plain, matching the schema's own existing design (not redesigned here).
const ALGORITHM = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "sofsavdo-payout-methods", 32);
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(encrypted: string, secret: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted value");
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

// The only shape this value is ever allowed to leave the backend in — the full/decrypted number
// is never serialized into any API response (see PayoutMethodsService).
export function maskCardNumber(digits: string): string {
  const last4 = digits.replace(/\s/g, "").slice(-4);
  return `•••• ${last4}`;
}
