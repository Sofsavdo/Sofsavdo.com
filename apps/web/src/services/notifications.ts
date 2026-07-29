"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";
import type { RealNotificationCategory } from "@sofsavdo/types";

// Communication & Notification domain (Phase 10) — real backend only, no mock counterpart. Works
// for any authenticated user (creator or staff), not just approved creators — see
// CreatorNotificationsController's own comment on why it isn't behind RequireCreatorGuard.

export function useNotifications(query?: api.NotificationListQuery) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["notifications", query],
    queryFn: () => api.getNotifications(query),
    enabled: !!user,
  });
}

function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

export function useNotificationPreferences() {
  const { user } = useSession();
  return useQuery({ queryKey: ["notification-preferences"], queryFn: api.getNotificationPreferences, enabled: !!user });
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category, patch }: { category: RealNotificationCategory; patch: { inApp?: boolean; telegram?: boolean; email?: boolean } }) =>
      api.updateNotificationPreference(category, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });
}
