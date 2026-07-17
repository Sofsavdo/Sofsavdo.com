"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@rosti/types";
import * as api from "@/lib/api/admin";

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
