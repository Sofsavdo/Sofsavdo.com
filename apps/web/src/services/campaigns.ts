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
    mutationFn: ({ campaignId, input }: { campaignId: string; input?: api.CampaignApplicationInput }) => {
      if (!user) throw new Error("Not authenticated");
      return api.applyToCampaign(user.id, campaignId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-campaigns", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

// ---- Per-application management (real backend only — mock resolves an empty list, so the
// application panel never renders there; see lib/api/index.ts) ----

export function useMyApplications() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: api.getMyCampaignApplications,
    enabled: !!user,
  });
}

function useApplicationMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["my-campaigns", user?.id] });
    },
  });
}

export function useUpdateApplication() {
  return useApplicationMutation(({ id, input }: { id: string; input: api.CampaignApplicationInput }) =>
    api.updateCampaignApplication(id, input),
  );
}

export function useResubmitApplication() {
  return useApplicationMutation((id: string) => api.resubmitCampaignApplication(id));
}

export function useWithdrawApplication() {
  return useApplicationMutation((id: string) => api.withdrawCampaignApplication(id));
}
