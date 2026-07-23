"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatorUser } from "@rosti/types";
import * as api from "../lib/api";

interface SessionContextValue {
  user: CreatorUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CreatorUser>;
  loginPending: boolean;
  loginError: string | null;
  register: (email: string, fullName: string, password: string, referralCode?: string) => Promise<CreatorUser>;
  registerPending: boolean;
  registerError: string | null;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Every consumer of this session is itself a client component behind a loading skeleton
  // (see the (app) layout guard and each page's isLoading branch), so there is no server-rendered
  // content that depends on this value — no separate "wait for client mount" flag is needed on
  // top of TanStack Query's own isLoading.
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.getSession,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: (user) => queryClient.setQueryData(["session"], user),
  });

  const registerMutation = useMutation({
    mutationFn: ({
      email,
      fullName,
      password,
      referralCode,
    }: {
      email: string;
      fullName: string;
      password: string;
      referralCode?: string;
    }) => api.register(email, fullName, password, referralCode),
    onSuccess: (user) => queryClient.setQueryData(["session"], user),
  });

  function logout() {
    api.logout();
    queryClient.setQueryData(["session"], null);
  }

  const value: SessionContextValue = {
    user: sessionQuery.data ?? null,
    isLoading: sessionQuery.isLoading,
    login: (email, password) => loginMutation.mutateAsync({ email, password }),
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error ? (loginMutation.error as api.ApiError).message : null,
    register: (email, fullName, password, referralCode) =>
      registerMutation.mutateAsync({ email, fullName, password, referralCode }),
    registerPending: registerMutation.isPending,
    registerError: registerMutation.error ? (registerMutation.error as api.ApiError).message : null,
    logout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
