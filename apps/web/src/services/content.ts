"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SocialPlatform } from "@rosti/types";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useContent() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["content", user?.id],
    queryFn: () => api.getContent(user!.id),
    enabled: !!user,
  });
}

export function useSubmitContent() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      creatorCampaignId: string;
      campaignName: string;
      caption: string;
      platform: SocialPlatform;
      draftFileNames: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      return api.submitContent(user.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", user?.id] });
    },
  });
}

// ---- Real Content domain (Phase 7A) — distinct from the legacy hooks above, which stay wired to
// the mock store's flat CreatorContent shape. These back the real draft/edit/submit/review-
// comment/version-history flow (real backend only).

export function useMyContents() {
  return useQuery({ queryKey: ["my-contents"], queryFn: api.getMyContents });
}

export function useMyContentDashboardCounts() {
  return useQuery({ queryKey: ["my-content-dashboard-counts"], queryFn: api.getMyContentDashboardCounts });
}

export function useContentDetail(id: string) {
  return useQuery({ queryKey: ["my-contents", "detail", id], queryFn: () => api.getContentDetail(id), enabled: !!id });
}

function useContentMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-contents"] });
      qc.invalidateQueries({ queryKey: ["my-content-dashboard-counts"] });
    },
  });
}

export function useCreateContentDraft() {
  return useContentMutation(({ campaignId, input }: { campaignId: string; input: api.CreateContentInput }) => api.createContentDraft(campaignId, input));
}

export function useUpdateContentDraft() {
  return useContentMutation(({ id, input }: { id: string; input: api.CreateContentInput }) => api.updateContentDraft(id, input));
}

export function useSubmitContentDraft() {
  return useContentMutation((id: string) => api.submitContentDraft(id));
}

export function useResubmitContentDraft() {
  return useContentMutation((id: string) => api.resubmitContentDraft(id));
}

export function useUploadContentAttachment() {
  return useContentMutation(({ contentId, input }: { contentId: string; input: api.UploadContentAttachmentInput }) => api.uploadContentAttachment(contentId, input));
}

export function useDeleteContentAttachment() {
  return useContentMutation((attachmentId: string) => api.deleteContentAttachment(attachmentId));
}
