import { randomInt } from "node:crypto";

// Excludes visually ambiguous characters (0/O, 1/I/L) — these codes are typed/read by humans
// (creators sharing a promo code in a caption, support agents reading them off a screen), so
// legibility matters more than a slightly larger alphabet.
const SUFFIX_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// node:crypto's randomInt, not Math.random() — Math.random() is not a cryptographically secure
// source and is explicitly disallowed here (Phase 6 spec §"promo code va referral code
// generatorlarini... Math.random()'ning o'ziga tayanma"). A promo code's suffix is effectively a
// short secret (guessing one lets a stranger apply a creator's discount), so it should come from
// the same class of RNG used for tokens elsewhere in this codebase (see TokenService).
export function randomSuffix(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return out;
}

// Turns a display name / slug into an uppercase, hyphen-safe fragment: strips everything that
// isn't a letter or digit, truncates to keep the final code reasonably short.
export function toCodePart(input: string, maxLen = 8): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics so e.g. "Gʻofur" degrades to "GOFUR"
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, maxLen) || "X";
}

// Shared shape behind both generators below: `PART1-PART2-SUFFIX`, e.g. `MALIKA-SERUM-X7K2`.
// Deliberately NOT deterministic from creator+campaign ids — two generation calls for the same
// creator/campaign pair produce different codes, which is what makes retry-on-collision
// meaningful (a deterministic generator would just collide again on retry).
function generateHumanCode(parts: string[], suffixLength = 4): string {
  const slugParts = parts.map((p) => toCodePart(p)).filter(Boolean);
  return [...slugParts, randomSuffix(suffixLength)].join("-");
}

export function generatePromoCode(creatorName: string, campaignOrOfferName: string): string {
  return generateHumanCode([creatorName, campaignOrOfferName]);
}

export function generateReferralCode(creatorName: string, campaignOrOfferName: string): string {
  return generateHumanCode([creatorName, campaignOrOfferName]);
}

// Generate a 5-character case-sensitive promo code for creator-to-creator referrals
// Uses the full alphabet (including lowercase) for case-sensitivity as requested
const PROMO_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const PROMO_CODE_LENGTH = 5;

export function generateCreatorPromoCode(): string {
  let out = "";
  for (let i = 0; i < PROMO_CODE_LENGTH; i++) {
    out += PROMO_ALPHABET[randomInt(PROMO_ALPHABET.length)];
  }
  return out;
}

// Prisma's unique-constraint violation code — duplicated here (rather than importing from
// @prisma/client just for a string literal) to keep this module free of a Prisma dependency, so
// it stays trivially unit-testable and reusable outside a Prisma context if needed.
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

interface PrismaLikeError {
  code?: string;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as PrismaLikeError).code === UNIQUE_CONSTRAINT_ERROR_CODE;
}

// Application-level collision handling: generate a fresh code and attempt the write; if the
// database's unique constraint rejects it (P2002), generate a new code and try again. The unique
// constraint itself remains the actual correctness guarantee — this loop only exists to turn the
// astronomically rare collision (given the alphabet/suffix length) into a silent retry instead of
// a user-facing error, per spec: "collision bo'lsa retry qilsin; database unique constraint
// yakuniy himoya bo'lsin".
export async function createWithUniqueCode<T>(
  generate: () => string,
  tryCreate: (code: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await tryCreate(generate());
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
