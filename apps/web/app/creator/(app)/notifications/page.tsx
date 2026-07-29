"use client";

import Link from "next/link";
import { useState } from "react";
import type { RealNotificationChannel } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "@sofsavdo/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/services/notifications";
import { notificationChannelMeta, notificationDeliveryStatusMeta, notificationTypeMeta } from "@/lib/status";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";
const CHANNELS: RealNotificationChannel[] = ["IN_APP", "TELEGRAM", "EMAIL"];

function RealNotificationsPage() {
  const [channel, setChannel] = useState<RealNotificationChannel | "ALL">("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const query = useNotifications({ channel: channel === "ALL" ? undefined : channel, unreadOnly: unreadOnly || undefined, page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Bildirishnomalar</h1>
        <div className="flex items-center gap-2">
          <Link href="/creator/notification-preferences" className="font-body text-sm text-accent hover:underline">
            Sozlamalar
          </Link>
          <Button size="sm" variant="outline" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Barchasini o&apos;qilgan deb belgilash
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as RealNotificationChannel | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha kanallar</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {notificationChannelMeta[c].label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-border"
          />
          Faqat o&apos;qilmaganlar
        </label>
      </div>

      {query.isError ? (
        <Alert tone="error">Bildirishnomalarni yuklashda xatolik yuz berdi.</Alert>
      ) : items.length === 0 ? (
        <EmptyState title="Bildirishnoma yo'q" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const meta = notificationTypeMeta[n.type] ?? { label: n.type, tone: "neutral" as const };
              return (
                <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-body text-sm font-semibold text-text-primary">{meta.label}</p>
                      {!n.readAt ? <Badge tone="accent">Yangi</Badge> : null}
                      <Badge tone="neutral">{notificationChannelMeta[n.channel]?.label ?? n.channel}</Badge>
                      {n.channel !== "IN_APP" ? <Badge tone={notificationDeliveryStatusMeta[n.status].tone}>{notificationDeliveryStatusMeta[n.status].label}</Badge> : null}
                    </div>
                    <p className="mt-1 font-body text-xs text-text-muted">{new Date(n.createdAt).toLocaleString("uz-UZ")}</p>
                  </div>
                  {!n.readAt ? (
                    <Button size="sm" variant="ghost" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
                      O&apos;qildi
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {query.data && query.data.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <span className="font-body text-xs text-text-muted">
                {query.data.page} / {query.data.totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= query.data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Keyingi
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function MockNotificationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Bildirishnomalar</h1>
      <Alert tone="info">Bildirishnomalar faqat real backend rejimida (NEXT_PUBLIC_API_MODE=real) mavjud.</Alert>
    </div>
  );
}

export default function NotificationsPage() {
  return USE_REAL_API ? <RealNotificationsPage /> : <MockNotificationsPage />;
}
