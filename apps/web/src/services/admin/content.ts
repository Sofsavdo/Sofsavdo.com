"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { ContentListQuery } from "@/lib/api/admin";

export function useAdminContent() {
  return useQuery({ queryKey: ["admin-content"], queryFn: api.getAllContent });
}

export function useApproveContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, contentId }: { userId: string; contentId: string }) => api.approveContent(userId, contentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-content"] }),
  });
}

export function useRequestContentRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, contentId, note }: { userId: string; contentId: string; note: string }) =>
      api.requestContentRevision(userId, contentId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-content"] }),
  });
}

export function useRejectContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, contentId, reason }: { userId: string; contentId: string; reason: string }) =>
      api.rejectContent(userId, contentId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-content"] }),
  });
}

// ---- Content review (Phase 7A, real backend) — distinct from the legacy mock-only hooks above.

export function useContentReviewList(query: ContentListQuery) {
  return useQuery({ queryKey: ["admin-content-review-list", query], queryFn: () => api.getContentReviewList(query) });
}

export function useContentReviewDetail(id: string) {
  return useQuery({ queryKey: ["admin-content-review-list", "detail", id], queryFn: () => api.getContentReviewDetail(id), enabled: !!id });
}

function useContentReviewMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-content-review-list"] }),
  });
}

export function useStartReviewContent() {
  return useContentReviewMutation((id: string) => api.startReviewContent(id));
}

export function useApproveContentReview() {
  return useContentReviewMutation(({ id, comment }: { id: string; comment?: string }) => api.approveContentReview(id, comment));
}

export function useRejectContentReview() {
  return useContentReviewMutation(({ id, reason }: { id: string; reason: string }) => api.rejectContentReview(id, reason));
}

export function useRequestChangesContent() {
  return useContentReviewMutation(({ id, reason }: { id: string; reason: string }) => api.requestChangesContent(id, reason));
}
