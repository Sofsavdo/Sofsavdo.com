import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type AlertTone = "error" | "success" | "info" | "warning";

const alertToneClasses: Record<AlertTone, string> = {
  error: "border-error/30 bg-error/5 text-error",
  success: "border-success/30 bg-success/5 text-success",
  info: "border-info/30 bg-info/5 text-info",
  warning: "border-warning/40 bg-warning/10 text-[#8a6d1a]",
};

export function Alert({
  tone = "info",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-input border px-4 py-3 font-body text-sm", alertToneClasses[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-input bg-border/60", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <p className="font-heading text-base font-semibold text-text-primary">{title}</p>
      {description ? <p className="max-w-sm font-body text-sm text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}
