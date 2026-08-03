"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as buyerApi from "../lib/api/buyer-real";
import type { BuyerUser } from "../lib/api/buyer-real";
import { ApiError } from "../lib/api/http-client";

interface BuyerSessionContextValue {
  user: BuyerUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<BuyerUser>;
  loginPending: boolean;
  loginError: string | null;
  register: (input: { email?: string; phone?: string; password: string; fullName: string }) => Promise<BuyerUser>;
  registerPending: boolean;
  registerError: string | null;
  logout: () => void;
}

const BuyerSessionContext = createContext<BuyerSessionContextValue | null>(null);

// Mirrors services/session.tsx's shape exactly (same TanStack Query cache-as-session-store
// pattern) but deliberately its own provider/hook, not a generalized "principal session" — a
// buyer has no onboarding-status gate to carry around, and reusing CreatorUser's shape here would
// mean every buyer page importing fields (`application.status`) that make no sense for a buyer.
export function BuyerSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["buyer-session"],
    queryFn: buyerApi.getSession,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // Do not retry on 401 Unauthorized - clear session and redirect
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
        queryClient.setQueryData(["buyer-session"], null);
        if (typeof window !== 'undefined') {
          window.location.href = '/buyer/login';
        }
        return false;
      }
      return failureCount < 1;
    },
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => buyerApi.login(email, password),
    onSuccess: (user) => queryClient.setQueryData(["buyer-session"], user),
  });

  const registerMutation = useMutation({
    mutationFn: (input: { email?: string; phone?: string; password: string; fullName: string }) => buyerApi.registerBuyer(input),
    onSuccess: (user) => queryClient.setQueryData(["buyer-session"], user),
  });

  function logout() {
    buyerApi.logout();
    queryClient.setQueryData(["buyer-session"], null);
  }

  const value: BuyerSessionContextValue = {
    user: sessionQuery.data ?? null,
    isLoading: sessionQuery.isLoading,
    login: (email, password) => loginMutation.mutateAsync({ email, password }),
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error ? (loginMutation.error as ApiError).message : null,
    register: (input) => registerMutation.mutateAsync(input),
    registerPending: registerMutation.isPending,
    registerError: registerMutation.error ? (registerMutation.error as ApiError).message : null,
    logout,
  };

  return <BuyerSessionContext.Provider value={value}>{children}</BuyerSessionContext.Provider>;
}

export function useBuyerSession(): BuyerSessionContextValue {
  const ctx = useContext(BuyerSessionContext);
  if (!ctx) throw new Error("useBuyerSession must be used within BuyerSessionProvider");
  return ctx;
}
