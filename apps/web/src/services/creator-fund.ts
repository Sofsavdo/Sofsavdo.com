"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useFundStats() {
  const { user } = useSession();
  return useQuery({ queryKey: ["creator-fund-stats"], queryFn: () => api.getFundStats(), enabled: !!user });
}

// Same short-interval polling convention as the platform/competition leaderboards — see
// DECISIONS.md ADR-029/ADR-030.
export function useFundLeaderboard() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["creator-fund-leaderboard"],
    queryFn: () => api.getFundLeaderboard(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useContributeToFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; message?: string }) => api.contributeToFund(input.amountMinor, input.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-fund-stats"] });
      queryClient.invalidateQueries({ queryKey: ["creator-fund-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["real-payouts"] });
    },
  });
}
