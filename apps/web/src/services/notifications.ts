"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";
import type { RealNotificationCategory } from "@sofsavdo/types";

// Communication & Notification domain (Phase 10) — real backend only, no mock counterpart. Works
// for any authenticated user (creator or staff), not just approved creators — see
// CreatorNotificationsController's own comment on why it isn't behind RequireCreatorGuard.
//
// Deliberately no `enabled: !!user` gate here (unlike useNotificationPreferences below, which is
// only ever rendered on a creator-only settings page). This hook is shared by both the creator and
// buyer notifications pages, but gating on the creator SessionProvider's `user` was a real bug for
// buyers: a buyer-only account has no creatorId, so creator-real.ts's getSession() deliberately
// throws 403 -> caught -> resolves to `user: null` -> this query silently never fired for any
// buyer, permanently rendering an empty list no matter how many real notifications existed. Both
// call sites already sit behind their own principal's app guard, so an unauthenticated render is
// not reachable here — a real 401 would just surface through query.isError like any other failure.
export function useNotifications(query?: api.NotificationListQuery) {
  return useQuery({
    queryKey: ["notifications", query],
    queryFn: () => api.getNotifications(query),
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
