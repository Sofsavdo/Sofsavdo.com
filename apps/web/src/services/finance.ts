"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useSales() {
  const { user } = useSession();
  return useQuery({ queryKey: ["sales", user?.id], queryFn: () => api.getSales(user!.id), enabled: !!user });
}

export function useCommissions() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["commissions", user?.id],
    queryFn: () => api.getCommissions(user!.id),
    enabled: !!user,
  });
}

export function useBalance() {
  const { user } = useSession();
  return useQuery({ queryKey: ["balance", user?.id], queryFn: () => api.getBalance(user!.id), enabled: !!user });
}

export function usePayoutMethods() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["payout-methods", user?.id],
    queryFn: () => api.getPayoutMethods(user!.id),
    enabled: !!user,
  });
}

export function useAddPayoutMethod() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { cardNumber: string; cardHolder: string }) => {
      if (!user) throw new Error("Not authenticated");
      return api.addPayoutMethod(user.id, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payout-methods", user?.id] }),
  });
}

export function usePayouts() {
  const { user } = useSession();
  return useQuery({ queryKey: ["payouts", user?.id], queryFn: () => api.getPayouts(user!.id), enabled: !!user });
}

export function useRequestPayout() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; payoutMethodId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return api.requestPayout(user.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payouts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["balance", user?.id] });
    },
  });
}

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only, same
// no-mock-counterpart precedent as Content's real-mode-only hooks. Named distinctly
// (useWalletBalance/useWalletTransactions/...) to avoid colliding with the mock-only
// useBalance/useCommissions/usePayoutMethods/usePayouts/useRequestPayout above. ----

export function useWalletBalance() {
  const { user } = useSession();
  return useQuery({ queryKey: ["wallet-balance"], queryFn: api.getWalletBalance, enabled: !!user });
}

export function useWalletTransactions(page = 1) {
  const { user } = useSession();
  return useQuery({ queryKey: ["wallet-transactions", page], queryFn: () => api.getWalletTransactions(page), enabled: !!user });
}

export function useRealPayoutMethods() {
  const { user } = useSession();
  return useQuery({ queryKey: ["real-payout-methods"], queryFn: api.listPayoutMethods, enabled: !!user });
}

export function useCreatePayoutMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: api.CreatePayoutMethodInput) => api.createPayoutMethod(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["real-payout-methods"] }),
  });
}

export function useSetDefaultPayoutMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.setDefaultPayoutMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["real-payout-methods"] }),
  });
}

export function useDeletePayoutMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePayoutMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["real-payout-methods"] }),
  });
}

export function usePayoutsMine(page = 1) {
  const { user } = useSession();
  return useQuery({ queryKey: ["real-payouts", page], queryFn: () => api.listPayoutsMine(page), enabled: !!user });
}

function invalidateWallet(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["real-payouts"] });
  queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
  queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
}

export function useRequestRealPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; payoutMethodId: string }) => api.requestRealPayout(input),
    onSuccess: () => invalidateWallet(queryClient),
  });
}

export function useCancelRealPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelPayout(id),
    onSuccess: () => invalidateWallet(queryClient),
  });
}
