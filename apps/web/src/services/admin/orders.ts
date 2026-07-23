"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus, RealOrderStatus } from "@rosti/types";
import * as api from "@/lib/api/admin";
import type { OrderListQuery } from "@/lib/api/admin";

export function useAdminOrders() {
  return useQuery({ queryKey: ["admin-orders"], queryFn: api.getOrders });
}

export function useAdminOrder(id: string) {
  return useQuery({ queryKey: ["admin-orders", id], queryFn: () => api.getOrder(id), enabled: !!id });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) => api.updateOrderStatus(id, status, note),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-orders", vars.id] });
      qc.invalidateQueries({ queryKey: ["admin-commissions"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });
}

export function useUpdateOrderNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, internalNotes }: { id: string; internalNotes: string }) => api.updateOrderNotes(id, internalNotes),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["admin-orders", vars.id] }),
  });
}

export function useAdminPayments() {
  return useQuery({ queryKey: ["admin-payments"], queryFn: api.getPayments });
}

export function useAdminRefunds() {
  return useQuery({ queryKey: ["admin-refunds"], queryFn: api.getRefunds });
}

export function useCreateRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amountMinor, reason, isPartial }: { orderId: string; amountMinor: number; reason: string; isPartial: boolean }) =>
      api.createRefund(orderId, amountMinor, reason, isPartial),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-refunds"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-commissions"] });
    },
  });
}

// ---- Order management (Phase 8, real backend) — distinct from the legacy mock-only hooks above.

export function useOrderReviewList(query: OrderListQuery = {}) {
  return useQuery({ queryKey: ["admin-order-review-list", query], queryFn: () => api.getOrderReviewList(query) });
}

export function useOrderReviewDetail(id: string) {
  return useQuery({ queryKey: ["admin-order-review-list", "detail", id], queryFn: () => api.getOrderReviewDetail(id), enabled: !!id });
}

function useOrderReviewMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-order-review-list"] }),
  });
}

export function useUpdateRealOrderStatus() {
  return useOrderReviewMutation(({ id, status, note }: { id: string; status: RealOrderStatus; note?: string }) => api.updateRealOrderStatus(id, status, note));
}

export function useUpdateRealOrderNotes() {
  return useOrderReviewMutation(({ id, notes }: { id: string; notes: string }) => api.updateRealOrderNotes(id, notes));
}

export function useCreateRealOrderRefund() {
  return useOrderReviewMutation(({ id, amountMinor, reason }: { id: string; amountMinor: number; reason: string }) => api.createRealOrderRefund(id, amountMinor, reason));
}
