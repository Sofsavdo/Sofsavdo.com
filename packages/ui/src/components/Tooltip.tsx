"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

// CSS-only, no positioning library — every current use case (a label truncated by ellipsis, a
// KPI's definition) is a short string anchored directly above a small trigger, which a fixed
// `bottom-full` popover handles without needing viewport-aware repositioning logic. If a future
// use case needs edge-aware flipping, that's the point to reach for a real positioning library,
// not before.
export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-input bg-dark px-2.5 py-1.5 font-body text-xs text-white shadow-elevated"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
