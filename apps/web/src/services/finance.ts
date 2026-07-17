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
