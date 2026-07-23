import { applyBasisPoints, impliedDiscountBasisPoints, isValidBasisPoints, minorToSoum, soumToMinor } from "./money";

describe("money helpers", () => {
  it("converts so'm to minor units", () => {
    expect(soumToMinor(249)).toBe(24_900);
    expect(soumToMinor(249.5)).toBe(24_950);
  });

  it("converts minor units back to so'm", () => {
    expect(minorToSoum(24_900)).toBe(249);
  });

  it("matches the COMMISSION.md worked example", () => {
    // Original price 100,000; discount 10,000; base 90,000; rate 20% (2000 bps) → 18,000.
    const base = 100_000 - 10_000;
    expect(applyBasisPoints(base, 2000)).toBe(18_000);
  });

  it("rounds fractional basis-point results instead of truncating silently", () => {
    expect(applyBasisPoints(333, 3333)).toBe(Math.round((333 * 3333) / 10_000));
  });

  describe("isValidBasisPoints", () => {
    it("accepts the full valid range, boundaries included", () => {
      expect(isValidBasisPoints(0)).toBe(true);
      expect(isValidBasisPoints(10_000)).toBe(true);
      expect(isValidBasisPoints(2000)).toBe(true);
    });

    it("rejects out-of-range and non-integer values", () => {
      expect(isValidBasisPoints(-1)).toBe(false);
      expect(isValidBasisPoints(10_001)).toBe(false);
      expect(isValidBasisPoints(50.5)).toBe(false);
    });
  });

  describe("impliedDiscountBasisPoints", () => {
    it("computes the discount implied by original vs. sale price", () => {
      expect(impliedDiscountBasisPoints(100_000, 75_000)).toBe(2500); // 25%
    });

    it("returns 0 when original price is equal to sale price (no discount)", () => {
      expect(impliedDiscountBasisPoints(100_000, 100_000)).toBe(0);
    });

    it("returns 0 (not negative) when sale price exceeds original — an invalid state elsewhere, not this helper's job to flag", () => {
      expect(impliedDiscountBasisPoints(100_000, 120_000)).toBe(0);
    });

    it("returns 0 for a zero or negative original price instead of dividing by zero", () => {
      expect(impliedDiscountBasisPoints(0, 0)).toBe(0);
      expect(impliedDiscountBasisPoints(-100, -50)).toBe(0);
    });

    it("rounds fractional basis points", () => {
      expect(impliedDiscountBasisPoints(30_000, 19_999)).toBe(Math.round(((30_000 - 19_999) / 30_000) * 10_000));
    });
  });
});
