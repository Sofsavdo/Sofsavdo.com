"use client";

import { useState } from "react";
import type { AnalyticsCompareMode, AnalyticsFilters, AnalyticsRangePreset } from "@sofsavdo/types";

// Shared local filter-state management for every analytics page (§6/§14 of ANALYTICS.md) — one
// hook instead of the same useState boilerplate repeated on 10 pages. Extra entity filters
// (creatorId/campaignId/productId/paymentMethod/region/status) are set directly on the returned
// `filters` object via `setFilters`/`setFilter`, since which ones apply differs per page.
export function useAnalyticsFilters(initial: Partial<AnalyticsFilters> = {}) {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: "this_month", compare: "none", page: 1, pageSize: 20, ...initial });

  function setRange(range: AnalyticsRangePreset) {
    setFilters((f) => ({ ...f, range, page: 1 }));
  }
  function setFrom(from: string) {
    setFilters((f) => ({ ...f, from, page: 1 }));
  }
  function setTo(to: string) {
    setFilters((f) => ({ ...f, to, page: 1 }));
  }
  function setCompare(compare: AnalyticsCompareMode) {
    setFilters((f) => ({ ...f, compare }));
  }
  function setFilter<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }
  function setPage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  return { filters, setRange, setFrom, setTo, setCompare, setFilter, setPage };
}
