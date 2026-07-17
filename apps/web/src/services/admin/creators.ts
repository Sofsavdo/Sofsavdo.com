"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export function useAdminCreators() {
  return useQuery({ queryKey: ["admin-creators"], queryFn: api.getCreators });
}

export function useAdminCreator(userId: string) {
  return useQuery({ queryKey: ["admin-creators", userId], queryFn: () => api.getCreator(userId), enabled: !!userId });
}

export function useCreatorCampaignHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-creator-campaign-history", userId],
    queryFn: () => api.getCreatorCampaignHistory(userId),
    enabled: !!userId,
  });
}

export function useCreatorStats(userId: string) {
  return useQuery({ queryKey: ["admin-creator-stats", userId], queryFn: () => api.getCreatorStats(userId), enabled: !!userId });
}

function invalidateCreator(qc: ReturnType<typeof useQueryClient>, userId: string) {
  qc.invalidateQueries({ queryKey: ["admin-creators"] });
  qc.invalidateQueries({ queryKey: ["admin-creators", userId] });
}

export function useApproveCreatorApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.approveCreatorApplication(userId),
    onSuccess: (_d, userId) => invalidateCreator(qc, userId),
  });
}

export function useRejectCreatorApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => api.rejectCreatorApplication(userId, reason),
    onSuccess: (_d, vars) => invalidateCreator(qc, vars.userId),
  });
}

export function useRequestCreatorRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => api.requestCreatorRevision(userId, reason),
    onSuccess: (_d, vars) => invalidateCreator(qc, vars.userId),
  });
}

export function useSetCreatorAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: "ACTIVE" | "SUSPENDED" | "BLOCKED"; reason?: string }) =>
      api.setCreatorAccountStatus(userId, status, reason),
    onSuccess: (_d, vars) => invalidateCreator(qc, vars.userId),
  });
}
