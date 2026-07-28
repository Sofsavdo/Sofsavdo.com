import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card } from "./Card";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}

const deltaClasses: Record<NonNullable<StatTileProps["delta"]>["direction"], string> = {
  up: "text-success",
  down: "text-error",
  flat: "text-text-muted",
};

// KPI tile for creator/admin dashboards. Numeric value uses font-numeric + tabular figures per
// DESIGN_SYSTEM.md so a row of these tiles lines up.
//
// Value text is responsive (text-xl -> sm:text-2xl -> md:text-3xl), not a flat text-3xl — Phase
// 15 fix: these tiles commonly render 2-per-row on mobile (see dashboard pages' `grid-cols-2`),
// and a long formatted currency string ("1 234 567 so'm") at 30px in a ~160px-wide mobile card
// was wrapping/crowding its label. `break-words` (not `truncate`) is deliberate — a truncated
// financial figure is actively dangerous (looks like a smaller, wrong number), so this allows a
// second line rather than ever hiding digits.
export function StatTile({ label, value, delta, className }: StatTileProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span className="font-body text-sm text-text-secondary">{label}</span>
      <span className="break-words font-numeric text-xl font-semibold tabular-nums text-text-primary sm:text-2xl md:text-3xl">
        {value}
      </span>
      {delta ? (
        <span className={cn("font-numeric text-sm tabular-nums", deltaClasses[delta.direction])}>
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"} {delta.value}
        </span>
      ) : null}
    </Card>
  );
}

// Converts a raw percent-change number (as returned by every Phase 13 analytics endpoint's
// `deltaPct`) into StatTile's delta shape — one place this mapping happens instead of every
// analytics page re-deriving "is up good or bad" formatting itself. `null`/`undefined` (no
// comparison period, or a from-zero comparison with nothing to compare — see
// executive-analytics.service.ts's `pctDelta`) renders as no delta at all.
export function deltaFromPct(pct: number | null | undefined): StatTileProps["delta"] | undefined {
  if (pct === null || pct === undefined) return undefined;
  return { value: `${Math.abs(pct).toFixed(1)}%`, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}
