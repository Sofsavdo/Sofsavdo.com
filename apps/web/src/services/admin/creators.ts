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

// ---- Creator administration (Phase 12, real backend, real-only) — distinct from the legacy
// mock-only hooks above, which stay untouched but are now unused (this page is replaced, not
// branched — see DECISIONS.md ADR-019). Onboarding decisions (approve/reject/request-changes) are
// deliberately NOT duplicated here — they already have a real, complete implementation at
// /admin/creator-applications (Phase 11); this domain is account administration only.

export function useRealCreatorList(query: import("@/lib/api/admin").RealCreatorQuery = {}) {
  return useQuery({ queryKey: ["admin-creators-real", query], queryFn: () => api.getRealCreatorList(query) });
}

export function useRealCreatorActivitySummary() {
  return useQuery({ queryKey: ["admin-creators-real", "activity-summary"], queryFn: () => api.getRealCreatorActivitySummary() });
}

export function useRealCreatorDetail(id: string) {
  return useQuery({ queryKey: ["admin-creators-real", "detail", id], queryFn: () => api.getRealCreatorDetail(id), enabled: !!id });
}

export function useRealCreatorCampaignHistory(id: string) {
  return useQuery({ queryKey: ["admin-creators-real", "campaign-history", id], queryFn: () => api.getRealCreatorCampaignHistory(id), enabled: !!id });
}

export function useRealCreatorEarningsSummary(id: string) {
  return useQuery({ queryKey: ["admin-creators-real", "earnings", id], queryFn: () => api.getRealCreatorEarningsSummary(id), enabled: !!id });
}

export function useRealCreatorPayoutSummary(id: string) {
  return useQuery({ queryKey: ["admin-creators-real", "payouts", id], queryFn: () => api.getRealCreatorPayoutSummary(id), enabled: !!id });
}

export function useRealCreatorReferralSummary(id: string) {
  return useQuery({ queryKey: ["admin-creators-real", "referrals", id], queryFn: () => api.getRealCreatorReferralSummary(id), enabled: !!id });
}

function useRealCreatorMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-creators-real"] }),
  });
}

export function useSuspendRealCreator() {
  return useRealCreatorMutation(({ id, reason }: { id: string; reason: string }) => api.suspendRealCreator(id, reason));
}

export function useUnsuspendRealCreator() {
  return useRealCreatorMutation((id: string) => api.unsuspendRealCreator(id));
}

export function useBlockRealCreator() {
  return useRealCreatorMutation(({ id, reason }: { id: string; reason: string }) => api.blockRealCreator(id, reason));
}

export function useUnblockRealCreator() {
  return useRealCreatorMutation((id: string) => api.unblockRealCreator(id));
}

export function useSetCreatorBioCompliance() {
  return useRealCreatorMutation(({ id, status }: { id: string; status: import("@sofsavdo/types").BioComplianceStatus }) =>
    api.setCreatorBioCompliance(id, status),
  );
}

export function useSetCreatorTier() {
  return useRealCreatorMutation(({ id, tier }: { id: string; tier: import("@sofsavdo/types").CreatorTier }) => api.setCreatorTier(id, tier));
}
