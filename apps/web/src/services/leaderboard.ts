"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

// Short-interval polling, not a websocket/SSE push — the confirmed architecture decision (see
// DECISIONS.md ADR-029): a leaderboard doesn't need sub-second latency to feel alive, and this
// codebase has zero push infrastructure today. The backend's own Redis cache TTL is 60s
// (CreatorLeaderboardService) — polling faster than that (30s) means roughly every other poll is
// a guaranteed cache hit, never a cold Postgres groupBy across every creator. Paused when the tab
// isn't focused (refetchIntervalInBackground: false) so an idle background tab doesn't keep
// polling for no one to see it — part of this session's performance-first mandate.
export function useLeaderboard() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["creator-leaderboard"],
    queryFn: () => api.getLeaderboard(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
