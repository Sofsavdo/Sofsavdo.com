"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { OnboardingQuery } from "@/lib/api/admin";

export function useOnboardingApplicationList(query: OnboardingQuery = {}) {
  return useQuery({ queryKey: ["admin-onboarding-list", query], queryFn: () => api.getOnboardingApplicationList(query) });
}

export function useOnboardingApplicationDetail(id: string) {
  return useQuery({ queryKey: ["admin-onboarding-list", "detail", id], queryFn: () => api.getOnboardingApplicationDetail(id), enabled: !!id });
}

export function useOnboardingAuditTrail(id: string) {
  return useQuery({ queryKey: ["admin-onboarding-audit", id], queryFn: () => api.getOnboardingAuditTrail(id), enabled: !!id });
}

function useOnboardingReviewMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-onboarding-list"] });
      // Every review action (start-review/approve/reject/request-changes) writes a new AuditLog
      // row (see onboarding.service.ts) — the audit-trail panel has its own query key, so it needs
      // its own invalidation or it keeps showing the stale (pre-action) history.
      qc.invalidateQueries({ queryKey: ["admin-onboarding-audit"] });
    },
  });
}

export function useStartReviewOnboardingApplication() {
  return useOnboardingReviewMutation((id: string) => api.startReviewOnboardingApplication(id));
}

export function useApproveOnboardingApplication() {
  return useOnboardingReviewMutation((id: string) => api.approveOnboardingApplication(id));
}

export function useRejectOnboardingApplication() {
  return useOnboardingReviewMutation(({ id, reason }: { id: string; reason: string }) => api.rejectOnboardingApplication(id, reason));
}

export function useRequestChangesOnboardingApplication() {
  return useOnboardingReviewMutation(({ id, reason }: { id: string; reason: string }) => api.requestChangesOnboardingApplication(id, reason));
}
