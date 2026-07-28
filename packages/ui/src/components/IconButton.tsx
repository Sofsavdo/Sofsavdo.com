"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "ghost" | "outline" | "solid";
type Size = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Required, not optional — an icon-only control with no accessible name is a real a11y bug, not a style nit. */
  "aria-label": string;
}

const variantClasses: Record<Variant, string> = {
  ghost: "text-text-muted hover:bg-bg hover:text-text-primary",
  outline: "border border-border text-text-primary bg-surface hover:bg-bg",
  solid: "bg-accent text-white hover:bg-accent-hover",
};

const sizeClasses: Record<Size, string> = {
  sm: "size-8",
  md: "size-10",
};

// Every icon-only trigger in this codebase (drawer close, row action menus, copy buttons) was
// previously a hand-rolled `<button className="rounded-input p-2 ...">` repeated per call site —
// this is the same shape, componentized, so the hit target/focus-ring/disabled behavior is
// consistent everywhere rather than re-derived per page.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-input transition-colors duration-150",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
