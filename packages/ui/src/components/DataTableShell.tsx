import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "./Feedback";
import { Button } from "./Button";
import { cn } from "../lib/cn";

export interface DataTableShellProps {
  title: string;
  description?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  /** The real `<table>` — every admin/creator list table had zero mobile alternative before
      Phase 15 (confirmed by audit: every one just rendered the same `<table>` under
      `overflow-x-auto` at every viewport). Hidden below `md` when `mobileCards` is provided. */
  children: ReactNode;
  /** A list of `MobileDataCard`s covering the same rows as `children`'s table — rendered instead
      of the table below `md`, outside the table's own bordered/rounded wrapper (a MobileDataCard
      already has its own border/shadow, so it must not be double-boxed inside the table's
      container too). Omit to keep the previous table-at-every-width behavior for a page that
      hasn't been given a card layout yet. */
  mobileCards?: ReactNode;
}

// The shared chrome every /admin list page wraps its table/cards in — search box, filter slot,
// loading/error/empty states, and pagination — so those five things are consistent everywhere
// instead of re-implemented (and re-forgotten) per page.
export function DataTableShell({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Qidirish...",
  filters,
  actions,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  page,
  pageCount,
  onPageChange,
  children,
  mobileCards,
}: DataTableShellProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{title}</h1>
          {description ? <p className="mt-1 font-body text-sm text-text-secondary">{description}</p> : null}
        </div>
        {actions}
      </div>

      {(onSearchChange || filters) && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end">
          {onSearchChange ? (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-input border border-border bg-bg pl-9 pr-3 font-body text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          ) : null}
          {filters}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <Alert tone="error">
          Ma&apos;lumotlarni yuklashda xatolik yuz berdi.{" "}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="underline">
              Qayta urinish
            </button>
          ) : null}
        </Alert>
      ) : isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <>
          {mobileCards ? <div className="space-y-3 md:hidden">{mobileCards}</div> : null}
          <div className={cn("overflow-x-auto rounded-card border border-border bg-surface", mobileCards && "hidden md:block")}>
            {children}
          </div>
          {pageCount && pageCount > 1 ? (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }).map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={page === i + 1 ? "solid" : "outline"}
                  className={cn("min-w-9")}
                  onClick={() => onPageChange?.(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
