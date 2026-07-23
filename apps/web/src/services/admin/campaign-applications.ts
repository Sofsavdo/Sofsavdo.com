"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { CampaignApplicationListQuery } from "@/lib/api/admin";

// Review workflow for per-Campaign creator applications (Creator Application domain) — distinct
// from services/admin/creators.ts's onboarding-application review, which is about becoming a
// creator at all.

export function useCampaignApplicationList(query: CampaignApplicationListQuery) {
  return useQuery({
    queryKey: ["admin-campaign-application-list", query],
    queryFn: () => api.getCampaignApplicationList(query),
  });
}

export function useCampaignApplicationDetail(id: string) {
  return useQuery({
    queryKey: ["admin-campaign-application-list", "detail", id],
    queryFn: () => api.getCampaignApplication(id),
    enabled: !!id,
  });
}

function useReviewMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaign-application-list"] });
      // Approval changes the campaign's approvedCreatorCount / capacity display.
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });
}

export function useStartReviewApplication() {
  return useReviewMutation((id: string) => api.startReviewCampaignApplication(id));
}

export function useApproveApplication() {
  return useReviewMutation((id: string) => api.approveCampaignApplicationReview(id));
}

export function useRejectApplication() {
  return useReviewMutation(({ id, reason }: { id: string; reason: string }) => api.rejectCampaignApplicationReview(id, reason));
}

export function useRequestChangesApplication() {
  return useReviewMutation(({ id, reason }: { id: string; reason: string }) => api.requestChangesCampaignApplication(id, reason));
}
