import { resolveAnalyticsRange } from "./time-range.resolver";

// Fixed reference "now" so every test is deterministic regardless of when it runs: a Wednesday
// (2026-07-15), mid-month, mid-quarter (Q3 starts July), mid-year.
const NOW = new Date(2026, 6, 15, 10, 30, 0); // July 15, 2026, 10:30 local

describe("resolveAnalyticsRange", () => {
  it("resolves today as [start of today, start of tomorrow)", () => {
    const { current } = resolveAnalyticsRange({ range: "today", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 6, 15));
    expect(current.to).toEqual(new Date(2026, 6, 16));
  });

  it("resolves yesterday as [start of yesterday, start of today)", () => {
    const { current } = resolveAnalyticsRange({ range: "yesterday", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 6, 14));
    expect(current.to).toEqual(new Date(2026, 6, 15));
  });

  it("resolves this_week starting Monday (ISO week)", () => {
    const { current } = resolveAnalyticsRange({ range: "this_week", compare: "none" }, NOW);
    // July 15, 2026 is a Wednesday; the Monday of that week is July 13.
    expect(current.from).toEqual(new Date(2026, 6, 13));
    expect(current.to).toEqual(new Date(2026, 6, 20));
  });

  it("resolves last_week as the 7 days before this_week", () => {
    const { current } = resolveAnalyticsRange({ range: "last_week", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 6, 6));
    expect(current.to).toEqual(new Date(2026, 6, 13));
  });

  it("resolves this_month as [1st of month, 1st of next month)", () => {
    const { current } = resolveAnalyticsRange({ range: "this_month", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 6, 1));
    expect(current.to).toEqual(new Date(2026, 7, 1));
  });

  it("resolves last_month correctly across a year boundary (January -> December)", () => {
    const jan = new Date(2026, 0, 10);
    const { current } = resolveAnalyticsRange({ range: "last_month", compare: "none" }, jan);
    expect(current.from).toEqual(new Date(2025, 11, 1));
    expect(current.to).toEqual(new Date(2026, 0, 1));
  });

  it("resolves quarter as the current 3-month block", () => {
    const { current } = resolveAnalyticsRange({ range: "quarter", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 6, 1)); // Q3 starts July
    expect(current.to).toEqual(new Date(2026, 9, 1));
  });

  it("resolves year as [Jan 1, next Jan 1)", () => {
    const { current } = resolveAnalyticsRange({ range: "year", compare: "none" }, NOW);
    expect(current.from).toEqual(new Date(2026, 0, 1));
    expect(current.to).toEqual(new Date(2027, 0, 1));
  });

  describe("custom", () => {
    it("resolves a valid custom range", () => {
      const { current } = resolveAnalyticsRange({ range: "custom", from: "2026-01-01", to: "2026-02-01", compare: "none" }, NOW);
      expect(current.from.toISOString().slice(0, 10)).toBe("2026-01-01");
      expect(current.to.toISOString().slice(0, 10)).toBe("2026-02-01");
    });

    it("throws VALIDATION_ERROR when from/to are missing", () => {
      expect(() => resolveAnalyticsRange({ range: "custom", compare: "none" }, NOW)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    });

    it("throws VALIDATION_ERROR when from is not before to", () => {
      expect(() => resolveAnalyticsRange({ range: "custom", from: "2026-02-01", to: "2026-01-01", compare: "none" }, NOW)).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    });

    it("throws VALIDATION_ERROR on an unparseable date string", () => {
      expect(() => resolveAnalyticsRange({ range: "custom", from: "not-a-date", to: "2026-01-01", compare: "none" }, NOW)).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    });
  });

  describe("compare modes", () => {
    it("previous: the immediately preceding period of equal length", () => {
      const { current, previous } = resolveAnalyticsRange({ range: "this_month", compare: "previous" }, NOW);
      expect(previous!.to).toEqual(current.from);
      expect(previous!.from.getTime()).toBe(current.from.getTime() - (current.to.getTime() - current.from.getTime()));
    });

    it("wow: shifts both bounds back 7 days", () => {
      const { current, previous } = resolveAnalyticsRange({ range: "this_week", compare: "wow" }, NOW);
      expect(previous!.from).toEqual(new Date(2026, 6, 6));
      expect(previous!.to).toEqual(new Date(2026, 6, 13));
      expect(current.from).toEqual(new Date(2026, 6, 13));
    });

    it("mom: shifts both bounds back one calendar month", () => {
      const { previous } = resolveAnalyticsRange({ range: "this_month", compare: "mom" }, NOW);
      expect(previous!.from).toEqual(new Date(2026, 5, 1));
      expect(previous!.to).toEqual(new Date(2026, 6, 1));
    });

    it("mom clamps day-of-month overflow (Mar 31 -> Feb 28 in a non-leap year)", () => {
      const { previous } = resolveAnalyticsRange({ range: "custom", from: "2027-03-31", to: "2027-04-01", compare: "mom" }, NOW);
      expect(previous!.from.toISOString().slice(0, 10)).toBe("2027-02-28"); // 2027 is not a leap year
    });

    it("yoy: shifts both bounds back one calendar year", () => {
      const { previous } = resolveAnalyticsRange({ range: "this_month", compare: "yoy" }, NOW);
      expect(previous!.from).toEqual(new Date(2025, 6, 1));
      expect(previous!.to).toEqual(new Date(2025, 7, 1));
    });

    it("none: no previous period is computed", () => {
      const { previous } = resolveAnalyticsRange({ range: "this_month", compare: "none" }, NOW);
      expect(previous).toBeUndefined();
    });

    it("defaults compare to none when omitted", () => {
      const { previous } = resolveAnalyticsRange({ range: "this_month" }, NOW);
      expect(previous).toBeUndefined();
    });
  });
});
