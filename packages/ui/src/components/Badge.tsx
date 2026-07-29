import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

// Generic status pill. Domain code (e.g. an OrderStatus -> tone map) lives at the call site in
// apps/web once the Prisma enums are mirrored into @sofsavdo/types — this component only knows
// about visual tones, never about a specific domain enum, so it stays reusable across
// Order/Commission/Payout/Campaign/Content statuses alike.
// A visible border alongside a light fill (not fill alone) so every tone reads as a distinct
// pill against both a white card and the page's own off-white background — 10% opacity fills
// alone turned out to be nearly invisible on white in practice.
const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-bg text-text-secondary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/50 bg-warning/20 text-[#8a6d1a]",
  error: "border-error/30 bg-error/10 text-error",
  info: "border-info/30 bg-info/10 text-info",
  accent: "border-accent/30 bg-accent/10 text-accent",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-body text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
