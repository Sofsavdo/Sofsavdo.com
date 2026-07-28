"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

// Role & Permission management (Phase 12, real backend, real-only) — no mock counterpart; the
// mock store's fixed 3-value AdminRole cannot represent arbitrary real roles (see
// DECISIONS.md ADR-019). Named "roleManagement" (not "roles") to avoid any ambiguity with the
// pre-existing mock-only useAdminRoles in system.ts, which stays untouched.

export function useRoleList() {
  return useQuery({ queryKey: ["admin-roles-real"], queryFn: api.getRealRoleList });
}

export function useRoleDetail(id: string) {
  return useQuery({ queryKey: ["admin-roles-real", "detail", id], queryFn: () => api.getRealRoleDetail(id), enabled: !!id });
}

export function useAllPermissionKeys() {
  return useQuery({ queryKey: ["admin-permissions"], queryFn: api.getAllPermissionKeys, staleTime: Infinity });
}

function useRoleMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-roles-real"] }),
  });
}

export function useCreateRole() {
  return useRoleMutation((input: { key: string; name: string; description?: string }) => api.createRealRole(input));
}

export function useUpdateRole() {
  return useRoleMutation(({ id, input }: { id: string; input: { name?: string; description?: string } }) => api.updateRealRole(id, input));
}

export function useAssignRolePermission() {
  return useRoleMutation(({ id, permissionKey }: { id: string; permissionKey: string }) => api.assignRolePermission(id, permissionKey));
}

export function useRemoveRolePermission() {
  return useRoleMutation(({ id, permissionKey }: { id: string; permissionKey: string }) => api.removeRolePermission(id, permissionKey));
}
