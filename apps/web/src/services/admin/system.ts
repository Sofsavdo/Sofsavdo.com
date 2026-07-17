"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export type { PlatformSettings } from "@/lib/api/admin";

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin-users"], queryFn: api.getUsers });
}

export function useAdminRoles() {
  return useQuery({ queryKey: ["admin-roles"], queryFn: api.getRoles });
}

export function useAdminSettings() {
  return useQuery({ queryKey: ["admin-settings"], queryFn: api.getSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof api.updateSettings>[0]) => api.updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });
}

export function useAdminAuditLog() {
  return useQuery({ queryKey: ["admin-audit-log"], queryFn: api.getAuditLog });
}
