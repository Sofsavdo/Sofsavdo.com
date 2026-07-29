"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

// Faster than the leaderboard's 30s poll (see DECISIONS.md ADR-029) — a "live" feed reads as
// stale sooner than a monthly ranking, and the backend's own cache TTL is shorter to match (20s).
// Paused when the tab isn't focused, same performance-first convention as every other polled
// creator-facing surface this session.
export function useActivityTicker() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["activity-ticker"],
    queryFn: () => api.getActivityTicker(),
    enabled: !!user,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
