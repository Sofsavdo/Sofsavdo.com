"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export function useAdminReferralLinks() {
  return useQuery({ queryKey: ["admin-referral-links"], queryFn: api.getReferralLinks });
}

export function useAdminPromoCodes() {
  return useQuery({ queryKey: ["admin-promo-codes"], queryFn: api.getPromoCodes });
}

export function useDeactivateReferralLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.deactivateReferralLink(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referral-links"] }),
  });
}

export function useAdminVisitors() {
  return useQuery({ queryKey: ["admin-visitors"], queryFn: api.getVisitors });
}

export function useOverrideAttribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, newCreatorId, reason }: { orderId: string; newCreatorId: string; reason: string }) =>
      api.overrideAttribution(orderId, newCreatorId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-visitors"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
  });
}
