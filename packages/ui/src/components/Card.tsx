import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // shadow-card: DESIGN_SYSTEM.md always specified "no drop shadow beyond a 1–2px ambient
      // shadow" — this applies that token (added Phase 15) so every Card gets subtle edge
      // definition instead of reading perfectly flat against the page background.
      className={cn("rounded-card border border-border bg-surface p-6 shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-heading text-lg font-semibold text-text-primary", className)}
      {...props}
    />
  );
}
