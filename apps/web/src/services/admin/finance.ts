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

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only, same
// no-mock-counterpart precedent as Content's real-mode-only hooks. Named distinctly to avoid
// colliding with the mock-only useAdminCommissions/useManualAdjustCommission/useAdminPayouts/
// useApprovePayout/useRejectPayout/useMarkPayoutPaid above. ----

export function useCommissionSettlementList(query?: api.CommissionSettlementQuery) {
  return useQuery({ queryKey: ["commission-settlement", query], queryFn: () => api.getCommissionSettlementList(query) });
}

function invalidateCommissionSettlement(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["commission-settlement"] });
}

export function useApproveCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveCommission(id),
    onSuccess: () => invalidateCommissionSettlement(qc),
  });
}

export function useRejectCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectCommission(id, reason),
    onSuccess: () => invalidateCommissionSettlement(qc),
  });
}

export function useMarkCommissionPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markCommissionPayable(id),
    onSuccess: () => invalidateCommissionSettlement(qc),
  });
}

export function useAdminPayoutList(query?: api.AdminPayoutQuery) {
  return useQuery({ queryKey: ["admin-payout-list", query], queryFn: () => api.getAdminPayoutList(query) });
}

function invalidateAdminPayoutList(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-payout-list"] });
  qc.invalidateQueries({ queryKey: ["commission-settlement"] });
}

export function useApproveAdminPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveAdminPayout(id),
    onSuccess: () => invalidateAdminPayoutList(qc),
  });
}

export function useRejectAdminPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectAdminPayout(id, reason),
    onSuccess: () => invalidateAdminPayoutList(qc),
  });
}

export function useMarkAdminPayoutProcessing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markAdminPayoutProcessing(id),
    onSuccess: () => invalidateAdminPayoutList(qc),
  });
}

export function useMarkAdminPayoutPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markAdminPayoutPaid(id),
    onSuccess: () => invalidateAdminPayoutList(qc),
  });
}

export function useMarkAdminPayoutFailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.markAdminPayoutFailed(id, reason),
    onSuccess: () => invalidateAdminPayoutList(qc),
  });
}
