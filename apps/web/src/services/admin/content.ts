"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

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
