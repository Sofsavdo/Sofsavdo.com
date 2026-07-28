"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { UserQuery, CreateStaffUserInput } from "@/lib/api/admin";

// Staff account management (Phase 12, real backend, real-only) — this domain's admin.ts and
// admin-real.ts functions have no mock counterpart at all (see DECISIONS.md ADR-019).

export function useStaffUserList(query: UserQuery = {}) {
  return useQuery({ queryKey: ["admin-staff", query], queryFn: () => api.getStaffUserList(query) });
}

export function useStaffUserDetail(id: string) {
  return useQuery({ queryKey: ["admin-staff", "detail", id], queryFn: () => api.getStaffUserDetail(id), enabled: !!id });
}

function useStaffMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-staff"] }),
  });
}

export function useCreateStaffUser() {
  return useStaffMutation((input: CreateStaffUserInput) => api.createStaffUser(input));
}

export function useUpdateStaffUser() {
  return useStaffMutation(({ id, input }: { id: string; input: Partial<Pick<CreateStaffUserInput, "displayName" | "email" | "phone">> }) => api.updateStaffUser(id, input));
}

export function useActivateStaffUser() {
  return useStaffMutation((id: string) => api.activateStaffUser(id));
}

export function useDeactivateStaffUser() {
  return useStaffMutation((id: string) => api.deactivateStaffUser(id));
}

export function useResetStaffUserPassword() {
  return useStaffMutation(({ id, newPassword }: { id: string; newPassword: string }) => api.resetStaffUserPassword(id, newPassword));
}

export function useAssignStaffUserRole() {
  return useStaffMutation(({ id, roleId }: { id: string; roleId: string }) => api.assignStaffUserRole(id, roleId));
}

export function useRemoveStaffUserRole() {
  return useStaffMutation(({ id, roleId }: { id: string; roleId: string }) => api.removeStaffUserRole(id, roleId));
}
