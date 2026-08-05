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

// ---- Settings & Audit log (Phase 12, real backend, real-only) — distinct from the legacy
// mock-only hooks above, which stay untouched but are now unused (these pages are replaced, not
// branched — see DECISIONS.md ADR-019). Settings is now the real, categorized 7-category catalog
// over the `Setting` model; Audit log is the general filterable/paginated browser.

export function useRealSettings() {
  return useQuery({ queryKey: ["admin-settings-real"], queryFn: api.getRealSettings });
}

export function useUpdateRealSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, string | number | boolean>) => api.updateRealSettings(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings-real"] }),
  });
}

export function useTelegramLinkStatus() {
  return useQuery({ queryKey: ["telegram-link-status"], queryFn: api.getTelegramLinkStatus });
}

export function useCreateTelegramLinkToken() {
  return useMutation({ mutationFn: api.createTelegramLinkToken });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.unlinkTelegram,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram-link-status"] }),
  });
}

export function useRealAuditLogList(query: import("@/lib/api/admin").RealAuditQuery = {}) {
  return useQuery({ queryKey: ["admin-audit-log-real", query], queryFn: () => api.getRealAuditLogList(query) });
}

export function useRealAuditLogDetail(id: string) {
  return useQuery({ queryKey: ["admin-audit-log-real", "detail", id], queryFn: () => api.getRealAuditLogDetail(id), enabled: !!id });
}
