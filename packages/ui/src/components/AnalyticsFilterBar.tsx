import type { ReactNode } from "react";
import { SelectField, TextField } from "./Field";

// Duplicated as narrow local literal unions rather than importing @rosti/types — packages/ui has
// no dependency on that package today (every other shared component is type-agnostic), and these
// two unions are small and stable enough that keeping them here doesn't create real drift risk;
// apps/web's own `AnalyticsRangePreset`/`AnalyticsCompareMode` (from @rosti/types, mirroring the
// backend's time-range.resolver.ts) must stay assignable to these.
export type AnalyticsRangePreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "quarter" | "year" | "custom";
export type AnalyticsCompareMode = "none" | "previous" | "wow" | "mom" | "yoy";

const RANGE_LABELS: Record<AnalyticsRangePreset, string> = {
  today: "Bugun",
  yesterday: "Kecha",
  this_week: "Shu hafta",
  last_week: "O'tgan hafta",
  this_month: "Shu oy",
  last_month: "O'tgan oy",
  quarter: "Chorak",
  year: "Yil",
  custom: "Boshqa oraliq",
};

const COMPARE_LABELS: Record<AnalyticsCompareMode, string> = {
  none: "Solishtirmasdan",
  previous: "Oldingi davr bilan",
  wow: "Hafta / hafta",
  mom: "Oy / oy",
  yoy: "Yil / yil",
};

export interface AnalyticsFilterBarProps {
  range: AnalyticsRangePreset;
  onRangeChange: (range: AnalyticsRangePreset) => void;
  from?: string;
  to?: string;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
  compare: AnalyticsCompareMode;
  onCompareChange: (compare: AnalyticsCompareMode) => void;
  /** Page-specific entity filters (creator/campaign/product/payment method/region/status selects) — each analytics page decides which ones make sense for it, same slot pattern as DataTableShell's own `filters`. */
  extra?: ReactNode;
}

// Shared across every analytics page (§6/§14 of ANALYTICS.md) — the 9 time-range presets, the 5
// comparison modes, and a slot for whichever entity filters a given page needs, so this structure
// exists in exactly one place rather than being redefined per page.
export function AnalyticsFilterBar({ range, onRangeChange, from, to, onFromChange, onToChange, compare, onCompareChange, extra }: AnalyticsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <SelectField label="Davr" value={range} onChange={(e) => onRangeChange(e.target.value as AnalyticsRangePreset)}>
        {Object.entries(RANGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      {range === "custom" ? (
        <>
          <TextField label="Boshlanishi" type="date" value={from ?? ""} onChange={(e) => onFromChange?.(e.target.value)} />
          <TextField label="Tugashi" type="date" value={to ?? ""} onChange={(e) => onToChange?.(e.target.value)} />
        </>
      ) : null}
      <SelectField label="Solishtirish" value={compare} onChange={(e) => onCompareChange(e.target.value as AnalyticsCompareMode)}>
        {Object.entries(COMPARE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      {extra}
    </div>
  );
}
