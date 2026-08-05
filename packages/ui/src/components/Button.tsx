"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";

type Variant = "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as the single child element (e.g. a Next.js `Link`) instead of a `<button>`. */
  asChild?: boolean;
}

// Design-system rule (DESIGN_SYSTEM.md): at most one solid-accent button visible per view.
// This component doesn't enforce that (it can't know about siblings) — it's a call-site
// discipline, noted here so it isn't rediscovered as a bug later.
const variantClasses: Record<Variant, string> = {
  solid: "bg-accent text-white hover:bg-accent-hover",
  outline: "border border-border text-text-primary bg-surface hover:bg-bg",
  ghost: "text-text-primary hover:bg-bg",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  // `min-h` rather than a fixed `h` — `lg` is the size used for primary CTAs whose label often
  // includes a dynamically-formatted price ("Hozir buyurtma bering — 24,900 so'm"), which can wrap
  // to two lines at narrow widths. A fixed height clipped that second line invisibly (flex
  // containers don't reveal vertical overflow on their own) — real bug, found on the checkout
  // page's submit button at 375px wide. `py-2` keeps single-line buttons visually identical to the
  // old fixed 48px height while letting genuinely long labels grow instead of losing text.
  lg: "min-h-12 px-6 py-2 text-lg leading-tight",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "solid", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-button font-body font-medium",
          "transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
