// All money is an integer count of minor units (1 so'm = 100 minor units) — see schema.prisma's
// header comment and DECISIONS.md ADR-004. These helpers exist so no call site does raw
// float math or forgets to round.

export function soumToMinor(soum: number): number {
  return Math.round(soum * 100);
}

export function minorToSoum(minor: number): number {
  return minor / 100;
}

// Percentage/discount values are stored as basis points (10000 = 100%) per COMMISSION.md.
export function applyBasisPoints(baseMinor: number, basisPoints: number): number {
  return Math.round((baseMinor * basisPoints) / 10_000);
}

export const MAX_BASIS_POINTS = 10_000;

// Shared bound for every percentage-shaped field in this codebase (discount %, commission %) —
// centralized here so Offer/Campaign/PromoCode validation all agree on what "a valid percentage"
// means instead of each module re-deriving 0..10000 independently.
export function isValidBasisPoints(basisPoints: number): boolean {
  return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= MAX_BASIS_POINTS;
}

// The discount implied by an original price vs. a sale price, expressed the same way every other
// percentage in this codebase is (basis points) — used for display (e.g. "-25%" on an offer card)
// and never stored: the two price fields are the source of truth, this is always derived.
export function impliedDiscountBasisPoints(originalMinor: number, saleMinor: number): number {
  if (originalMinor <= 0 || saleMinor >= originalMinor) return 0;
  return Math.round(((originalMinor - saleMinor) / originalMinor) * MAX_BASIS_POINTS);
}
