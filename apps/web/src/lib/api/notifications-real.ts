// Real-backend implementation of the creator/staff-facing Notification domain (Phase 10) —
// counterpart to wallet-real.ts. No mock counterpart exists (see @rosti/types' comment on
// RealNotification), so every function here is real-backend only.
import type { RealNotification, RealNotificationCategory, RealNotificationChannel, RealNotificationPreference } from "@rosti/types";
import { apiRequest } from "./http-client";

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  channel?: RealNotificationChannel;
  type?: string;
  unreadOnly?: boolean;
}

export async function getNotifications(query: NotificationListQuery = {}): Promise<PaginatedResponse<RealNotification>> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.channel) params.set("channel", query.channel);
  if (query.type) params.set("type", query.type);
  if (query.unreadOnly !== undefined) params.set("unreadOnly", String(query.unreadOnly));
  const qs = params.toString();
  return apiRequest(`/creator/notifications${qs ? `?${qs}` : ""}`);
}

export async function getNotification(id: string): Promise<RealNotification> {
  return apiRequest<RealNotification>(`/creator/notifications/${id}`);
}

export async function markNotificationRead(id: string): Promise<RealNotification> {
  return apiRequest<RealNotification>(`/creator/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiRequest<{ count: number }>("/creator/notifications/mark-all-read", { method: "POST" });
}

export async function getNotificationPreferences(): Promise<RealNotificationPreference[]> {
  return apiRequest<RealNotificationPreference[]>("/creator/notification-preferences");
}

export async function updateNotificationPreference(
  category: RealNotificationCategory,
  patch: { inApp?: boolean; telegram?: boolean; email?: boolean },
): Promise<RealNotificationPreference> {
  return apiRequest<RealNotificationPreference>(`/creator/notification-preferences/${category}`, { method: "PATCH", body: patch });
}
