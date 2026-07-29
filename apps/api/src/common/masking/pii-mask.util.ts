// PII display-masking helpers for read-only creator/staff-facing views — distinct from
// common/crypto/encryption.util.ts (which handles at-rest encryption of stored secrets, not
// display formatting of already-plaintext fields). Used first by /creator/sales, where a creator
// must be able to recognize their own buyers without ever seeing the buyer's full contact details.

// "Aziz Karimov" -> "A. Karimov". A single-word name has nothing to abbreviate, so it passes
// through unchanged rather than producing a misleading "A." with no surname.
export function maskCustomerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  return `${parts[0]!.charAt(0)}. ${parts.slice(1).join(" ")}`;
}

// "+998901234512" -> "+998 90 *** ** 12" for the standard 12-digit UZ E.164 shape (country code 3
// + operator 2 + subscriber 7). Any other digit count falls back to a generic tail-preserving mask
// rather than guessing at a grouping that wouldn't hold.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
  }
  return digits.length > 4 ? `${"*".repeat(digits.length - 4)}${digits.slice(-4)}` : phone;
}

export function maskCustomerContact(fullName: string, phone: string): string {
  return `${maskCustomerName(fullName)}, ${maskPhone(phone)}`;
}
