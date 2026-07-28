import { DomainException } from "../../common/errors/domain-error";

// Every analytics interval in this domain is half-open [from, to) — "to" is an exclusive upper
// bound. This is the one place that convention is decided; every sub-service consumes an already-
// resolved DateRange and never re-derives what "this month" means on its own. See ANALYTICS.md §13
// and DECISIONS.md ADR-020.
export interface DateRange {
  from: Date;
  to: Date;
}

export type AnalyticsRangePreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "quarter" | "year" | "custom";

export type AnalyticsCompareMode = "none" | "previous" | "wow" | "mom" | "yoy";

export interface ResolvedAnalyticsRange {
  current: DateRange;
  previous?: DateRange;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, delta: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + delta);
  return result;
}

// Clamps day-of-month overflow (e.g. Mar 31 minus 1 month lands on Feb 28/29, never "Mar 3") —
// matters for `mom`/`yoy` shifting an arbitrary custom range, even though the computed presets
// below only ever shift day-1 boundaries (which never overflow).
function addMonths(d: Date, delta: number): Date {
  const day = d.getDate();
  const targetFirst = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const daysInTarget = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  targetFirst.setDate(Math.min(day, daysInTarget));
  targetFirst.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return targetFirst;
}

function startOfISOWeek(d: Date): Date {
  const start = startOfDay(d);
  const day = start.getDay(); // 0 = Sunday
  const offset = day === 0 ? 6 : day - 1; // days since Monday
  return addDays(start, -offset);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), quarterStartMonth, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function resolvePreset(preset: Exclude<AnalyticsRangePreset, "custom">, now: Date): DateRange {
  switch (preset) {
    case "today": {
      const from = startOfDay(now);
      return { from, to: addDays(from, 1) };
    }
    case "yesterday": {
      const to = startOfDay(now);
      return { from: addDays(to, -1), to };
    }
    case "this_week": {
      const from = startOfISOWeek(now);
      return { from, to: addDays(from, 7) };
    }
    case "last_week": {
      const to = startOfISOWeek(now);
      return { from: addDays(to, -7), to };
    }
    case "this_month": {
      const from = startOfMonth(now);
      return { from, to: addMonths(from, 1) };
    }
    case "last_month": {
      const to = startOfMonth(now);
      return { from: addMonths(to, -1), to };
    }
    case "quarter": {
      const from = startOfQuarter(now);
      return { from, to: addMonths(from, 3) };
    }
    case "year": {
      const from = startOfYear(now);
      return { from, to: addMonths(from, 12) };
    }
  }
}

function resolveCustom(from?: string, to?: string): DateRange {
  if (!from || !to) {
    throw new DomainException("VALIDATION_ERROR", "range=custom uchun from va to talab qilinadi.", { from, to });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new DomainException("VALIDATION_ERROR", "from/to noto'g'ri sana formatida.", { from, to });
  }
  if (fromDate.getTime() >= toDate.getTime()) {
    throw new DomainException("VALIDATION_ERROR", "from qiymati to qiymatidan oldin bo'lishi kerak.", { from, to });
  }
  return { from: fromDate, to: toDate };
}

function shiftRange(range: DateRange, compare: Exclude<AnalyticsCompareMode, "none">): DateRange {
  if (compare === "previous") {
    const durationMs = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - durationMs), to: range.from };
  }
  if (compare === "wow") {
    return { from: addDays(range.from, -7), to: addDays(range.to, -7) };
  }
  if (compare === "mom") {
    return { from: addMonths(range.from, -1), to: addMonths(range.to, -1) };
  }
  // yoy
  return { from: addMonths(range.from, -12), to: addMonths(range.to, -12) };
}

export interface AnalyticsRangeQuery {
  range: AnalyticsRangePreset;
  from?: string;
  to?: string;
  compare?: AnalyticsCompareMode;
}

// The one place "what does 'this month' mean" / "what is the matching previous period" is
// decided — every analytics sub-service calls this instead of re-deriving date math itself.
export function resolveAnalyticsRange(query: AnalyticsRangeQuery, now: Date = new Date()): ResolvedAnalyticsRange {
  const current = query.range === "custom" ? resolveCustom(query.from, query.to) : resolvePreset(query.range, now);
  const compare = query.compare ?? "none";
  if (compare === "none") return { current };
  return { current, previous: shiftRange(current, compare) };
}
