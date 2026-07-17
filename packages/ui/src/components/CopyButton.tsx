"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/cn";

export function CopyButton({ value, className, label = "Nusxalash" }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (rare) — fail silently rather than throw in the UI.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 font-body text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent",
        copied && "border-success text-success",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Nusxalandi" : label}
    </button>
  );
}
