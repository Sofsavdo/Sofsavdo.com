import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface MobileDataCardField {
  label: string;
  value: ReactNode;
  /** Right-aligned, tabular — for a currency/count value that pairs with a left-aligned label. */
  emphasis?: boolean;
}

export interface MobileDataCardProps {
  /** Usually the row's primary identifier (a linked name, an order token) — rendered above the field list. */
  title: ReactNode;
  /** Rendered next to the title (e.g. a StatusBadge) — the single most important secondary fact about this row. */
  meta?: ReactNode;
  /** Optional small square thumbnail (e.g. a product photo) rendered left of the title — helps
   *  distinguish rows whose titles alone are ambiguous (near-identical product names). */
  image?: string;
  fields: MobileDataCardField[];
  /** Row actions (e.g. a link to detail, a dropdown) — rendered bottom-right. */
  actions?: ReactNode;
  href?: string;
  className?: string;
}

// The mobile fallback for every admin/creator data table (Phase 15 — the audit found zero
// mobile-card pattern anywhere; every table rendered as-is under horizontal scroll at every
// viewport width). Pair with a real `<table>` behind `hidden md:block` / this behind `md:hidden`
// at each table's call site — this component only owns the card's own layout, not the
// responsive switch itself, since which columns become "fields" vs. "title" is a per-table
// editorial decision, not something to infer generically.
export function MobileDataCard({ title, meta, image, fields, actions, href, className }: MobileDataCardProps) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn("block rounded-card border border-border bg-surface p-4 shadow-card", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- shared package, no next/image available here
            <img src={image} alt="" className="size-9 shrink-0 rounded-input object-cover" />
          ) : null}
          <div className="min-w-0 font-body text-sm font-medium text-text-primary">{title}</div>
        </div>
        {meta}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {fields.map((f, i) => (
          <div key={i} className={f.emphasis ? "col-span-2 flex items-center justify-between border-t border-border pt-2" : undefined}>
            <dt className="font-body text-xs text-text-muted">{f.label}</dt>
            <dd className={cn("font-body text-sm text-text-primary", f.emphasis && "font-numeric font-semibold")}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">{actions}</div> : null}
    </Wrapper>
  );
}
