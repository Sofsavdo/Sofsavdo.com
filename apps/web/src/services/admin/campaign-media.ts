"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { UploadMediaInput } from "@/lib/api/admin";

export function useCampaignMedia(campaignId: string) {
  return useQuery({ queryKey: ["admin-campaign-media", campaignId], queryFn: () => api.getCampaignMedia(campaignId), enabled: !!campaignId });
}

function useMediaMutation<TVars>(campaignId: string, mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-campaign-media", campaignId] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns", campaignId] });
    },
  });
}

export function useUploadCampaignMedia(campaignId: string) {
  return useMediaMutation(campaignId, (input: UploadMediaInput) => api.uploadCampaignMedia(campaignId, input));
}

export function useReplaceCampaignCover(campaignId: string) {
  return useMediaMutation(campaignId, (input: UploadMediaInput) => api.replaceCampaignCover(campaignId, input));
}

export function useSetCampaignMediaCover(campaignId: string) {
  return useMediaMutation(campaignId, (mediaId: string) => api.setCampaignMediaCover(mediaId));
}

export function useReorderCampaignMedia(campaignId: string) {
  return useMediaMutation(campaignId, (orderedIds: string[]) => api.reorderCampaignMedia(campaignId, orderedIds));
}

export function useUpdateCampaignMediaAltText(campaignId: string) {
  return useMediaMutation(campaignId, ({ mediaId, altText }: { mediaId: string; altText: string }) => api.updateCampaignMediaAltText(mediaId, altText));
}

export function useDeleteCampaignMedia(campaignId: string) {
  return useMediaMutation(campaignId, (mediaId: string) => api.deleteCampaignMedia(mediaId));
}
