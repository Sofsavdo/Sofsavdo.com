"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRole, AdminUser } from "@rosti/types";
import * as adminApi from "../lib/api/admin";

interface AdminSessionContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  loginPending: boolean;
  loginError: string | null;
  logout: () => void;
  devSwitchRole: (role: AdminRole) => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["admin-session"],
    queryFn: adminApi.adminGetSession,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => adminApi.adminLogin(email, password),
    onSuccess: (user) => queryClient.setQueryData(["admin-session"], user),
  });

  const devSwitchMutation = useMutation({
    mutationFn: (role: AdminRole) => adminApi.adminDevSwitchRole(role),
    onSuccess: (user) => queryClient.setQueryData(["admin-session"], user),
  });

  function logout() {
    adminApi.adminLogout();
    queryClient.setQueryData(["admin-session"], null);
  }

  const value: AdminSessionContextValue = {
    user: sessionQuery.data ?? null,
    isLoading: sessionQuery.isLoading,
    login: (email, password) => loginMutation.mutateAsync({ email, password }),
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error ? (loginMutation.error as adminApi.ApiError).message : null,
    logout,
    devSwitchRole: async (role) => {
      await devSwitchMutation.mutateAsync(role);
    },
  };

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return ctx;
}
