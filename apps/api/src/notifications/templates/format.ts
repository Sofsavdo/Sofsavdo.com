// Same "amount as integer minor units, format only at render time" convention as
// common/money/money.ts — this formatter is display-only, never used for arithmetic.
export function formatMoney(amountMinor: number, currency = "UZS"): string {
  const major = Math.round(amountMinor / 100);
  const formatted = major.toLocaleString("uz-UZ");
  return currency === "UZS" ? `${formatted} so'm` : `${formatted} ${currency}`;
}
