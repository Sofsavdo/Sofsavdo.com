"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export function useAdminCommissions() {
  return useQuery({ queryKey: ["admin-commissions"], queryFn: api.getCommissions });
}

export function useManualAdjustCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newAmountMinor, reason }: { id: string; newAmountMinor: number; reason: string }) =>
      api.manualAdjustCommission(id, newAmountMinor, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-commissions"] }),
  });
}

export function useAdminPayouts() {
  return useQuery({ queryKey: ["admin-payouts"], queryFn: api.getPayouts });
}

function invalidatePayouts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-payouts"] });
  qc.invalidateQueries({ queryKey: ["admin-commissions"] });
  qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
}

export function useApprovePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, referenceNumber }: { payoutId: string; referenceNumber: string }) => api.approvePayout(payoutId, referenceNumber),
    onSuccess: () => invalidatePayouts(qc),
  });
}

export function useRejectPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) => api.rejectPayout(payoutId, reason),
    onSuccess: () => invalidatePayouts(qc),
  });
}

export function useMarkPayoutPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payoutId, referenceNumber }: { payoutId: string; referenceNumber: string }) => api.markPayoutPaid(payoutId, referenceNumber),
    onSuccess: () => invalidatePayouts(qc),
  });
}
