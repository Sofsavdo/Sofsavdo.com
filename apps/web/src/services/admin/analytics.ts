"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { AnalyticsFilters } from "@/lib/api/admin";

export function useAdminAnalytics(filters: AnalyticsFilters = {}) {
  return useQuery({ queryKey: ["admin-analytics", filters], queryFn: () => api.getAnalytics(filters) });
}

export function useExportAnalyticsCsv() {
  return useMutation({ mutationFn: () => api.exportAnalyticsCsv() });
}
