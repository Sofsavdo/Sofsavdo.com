"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// A generic modal primitive — ConfirmModal (confirm/destructive-action flows) predates this and
// keeps its own hand-rolled overlay rather than being refactored onto this one; that component is
// widely used across admin financial actions and re-plumbing it isn't worth the regression risk
// for a visual-only pass. This is for new dialog needs (forms, detail popovers) that shouldn't
// each reinvent the overlay/Escape/scroll-lock behavior from scratch. Same hand-rolled
// overlay+panel approach as ConfirmModal (no @radix-ui/react-dialog dependency — not justified
// for what this codebase actually needs) rather than a new heavier primitive.
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-pad-mobile" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="absolute inset-0 bg-dark/40" onClick={onClose} />
      <div className={cn("relative w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-elevated", className)}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="dialog-title" className="font-heading text-base font-semibold text-text-primary">
              {title}
            </h3>
            {description ? <p className="mt-1 font-body text-sm text-text-secondary">{description}</p> : null}
          </div>
          <IconButton aria-label="Yopish" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
