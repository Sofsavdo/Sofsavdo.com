"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

// Communication & Notification domain (Phase 10) — real backend only, no mock counterpart.

export function useAdminNotificationList(query?: api.AdminNotificationQuery) {
  return useQuery({ queryKey: ["admin-notifications", query], queryFn: () => api.getAdminNotificationList(query) });
}

export function useAdminFailedNotificationList(query?: Omit<api.AdminNotificationQuery, "status">) {
  return useQuery({ queryKey: ["admin-notifications-failed", query], queryFn: () => api.getAdminFailedNotificationList(query) });
}

export function useRetryAdminNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryAdminNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["admin-notifications-failed"] });
    },
  });
}
