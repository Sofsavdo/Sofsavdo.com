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
export function StatTile({ label, value, delta, className }: StatTileProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span className="font-body text-sm text-text-secondary">{label}</span>
      <span className="font-numeric text-3xl font-semibold tabular-nums text-text-primary">
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
