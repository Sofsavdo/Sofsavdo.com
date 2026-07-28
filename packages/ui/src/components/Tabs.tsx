"use client";

import { cn } from "../lib/cn";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Several pages hand-rolled this exact "row of buttons, one active" pattern independently
// (e.g. the Product Analytics best-seller/slow-mover toggle) — this is the same visual shape,
// componentized with real tab semantics (role="tablist"/"tab", aria-selected, roving nothing
// fancier since these are always a handful of items) instead of a plain div+button per instance.
export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("inline-flex gap-1 rounded-input bg-bg p-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-input px-3 py-1.5 font-body text-sm transition-colors",
              active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
