"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { AdminReferralQuery, ReferralRuleInput } from "@/lib/api/admin";

export function useAdminReferrals(query: AdminReferralQuery) {
  return useQuery({ queryKey: ["admin-referrals", query], queryFn: () => api.getAdminReferrals(query) });
}

export function useAdminReferral(id: string) {
  return useQuery({ queryKey: ["admin-referrals", "detail", id], queryFn: () => api.getAdminReferral(id), enabled: !!id });
}

export function useDisqualifyReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.disqualifyReferral(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });
}

export function useReferralRules() {
  return useQuery({ queryKey: ["admin-referral-rules"], queryFn: api.getReferralRules });
}

function useRuleMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referral-rules"] }) });
}

export function useCreateReferralRule() {
  return useRuleMutation((input: ReferralRuleInput) => api.createReferralRule(input));
}

export function useUpdateReferralRule() {
  return useRuleMutation(({ id, input }: { id: string; input: Partial<ReferralRuleInput> }) => api.updateReferralRule(id, input));
}

export function useActivateReferralRule() {
  return useRuleMutation((id: string) => api.activateReferralRule(id));
}

export function useDeactivateReferralRule() {
  return useRuleMutation((id: string) => api.deactivateReferralRule(id));
}

export function useApproveReferralReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveReferralReward(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });
}

export function useRejectReferralReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectReferralReward(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });
}
