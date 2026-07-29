"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@sofsavdo/types";
import * as api from "@/lib/api/admin";
import type { CreateCampaignInput } from "@/lib/api/admin";

export function useAdminCampaigns() {
  return useQuery({ queryKey: ["admin-campaigns"], queryFn: api.getCampaigns });
}

export function useAdminCampaign(id: string) {
  return useQuery({ queryKey: ["admin-campaigns", id], queryFn: () => api.getCampaign(id), enabled: !!id });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => api.createCampaign(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Campaign> }) => api.updateCampaign(id, patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", vars.id] });
    },
  });
}

export function useActivateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.activateCampaign(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", id] });
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pauseCampaign(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", id] });
    },
  });
}

export function useCompleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.completeCampaign(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", id] });
    },
  });
}

export function useArchiveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveCampaign(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", id] });
    },
  });
}

export function useCampaignApplications() {
  return useQuery({ queryKey: ["admin-campaign-applications"], queryFn: api.getCampaignApplications });
}

export function useApproveCampaignApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ccId }: { userId: string; ccId: string }) => api.approveCampaignApplication(userId, ccId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaign-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-referral-links"] });
      qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });
}

export function useRejectCampaignApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ccId, reason }: { userId: string; ccId: string; reason: string }) =>
      api.rejectCampaignApplication(userId, ccId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaign-applications"] }),
  });
}
