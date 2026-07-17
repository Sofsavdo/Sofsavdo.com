"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Alert } from "./Feedback";

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  isPending?: boolean;
  error?: string | null;
  /** Extra fields rendered between the description and the reason textarea (e.g. a partial-refund amount input). */
  children?: ReactNode;
}

// Every destructive or reason-required admin action (reject/revision/refund/manual commission/
// manual attribution/payout decisions) routes through this one modal, so "confirmation + mandatory
// reason" is enforced structurally rather than re-implemented per page.
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  destructive = false,
  requireReason = false,
  reasonLabel = "Sabab",
  isPending = false,
  error,
  children,
}: ConfirmModalProps) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-pad-mobile">
      <div className="absolute inset-0 bg-dark/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-lg">
        <div className="flex items-start gap-3">
          {destructive ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error" /> : null}
          <div>
            <h3 className="font-heading text-base font-semibold text-text-primary">{title}</h3>
            {description ? <p className="mt-1 font-body text-sm text-text-secondary">{description}</p> : null}
          </div>
        </div>

        {children}

        {requireReason ? (
          <div className="mt-4">
            <label className="mb-1.5 block font-body text-sm font-medium text-text-primary">{reasonLabel}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="h-auto min-h-20 w-full rounded-input border border-border bg-bg px-3 py-2 font-body text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="Sababni kiriting..."
            />
          </div>
        ) : null}

        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            className={destructive ? "bg-error hover:bg-error/90" : undefined}
            disabled={!canConfirm || isPending}
            onClick={() => onConfirm(requireReason ? reason : undefined)}
          >
            {isPending ? "Bajarilmoqda..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
