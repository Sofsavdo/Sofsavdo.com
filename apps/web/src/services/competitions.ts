"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useMyCompetitions() {
  const { user } = useSession();
  return useQuery({ queryKey: ["creator-competitions"], queryFn: () => api.getMyCompetitions(), enabled: !!user });
}

// Same short-interval polling convention as the platform leaderboard (Phase K) — see
// DECISIONS.md ADR-029/ADR-030.
export function useCompetitionLeaderboard(competitionId: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["competition-leaderboard", competitionId],
    queryFn: () => api.getCompetitionLeaderboard(competitionId),
    enabled: !!user && !!competitionId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
