"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useDashboardStats() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => api.getDashboardStats(user!.id),
    enabled: !!user,
    // The backend itself caches this response for 30s (CreatorDashboardService, Redis-backed) —
    // matching staleTime here means re-visiting the dashboard within that window renders instantly
    // from the query cache with zero network round-trip, instead of a real request that would just
    // hit the backend's own cache anyway. Part of this session's performance-first mandate.
    staleTime: 30_000,
  });
}
