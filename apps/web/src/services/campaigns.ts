"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useCampaigns() {
  return useQuery({ queryKey: ["campaigns"], queryFn: api.getCampaigns });
}

export function useCampaign(id: string) {
  return useQuery({ queryKey: ["campaigns", id], queryFn: () => api.getCampaign(id) });
}

export function useMyCampaigns() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-campaigns", user?.id],
    queryFn: () => api.getMyCampaigns(user!.id),
    enabled: !!user,
  });
}

export function useApplyToCampaign() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => {
      if (!user) throw new Error("Not authenticated");
      return api.applyToCampaign(user.id, campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-campaigns", user?.id] });
    },
  });
}
