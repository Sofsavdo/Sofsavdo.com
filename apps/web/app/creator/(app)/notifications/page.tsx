"use client";

import Link from "next/link";
import { useState } from "react";
import type { RealNotification, RealNotificationChannel } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Skeleton } from "@sofsavdo/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/services/notifications";
import { notificationChannelMeta, notificationDeliveryStatusMeta } from "@/lib/status";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";
const CHANNELS: RealNotificationChannel[] = ["IN_APP", "TELEGRAM", "EMAIL"];

// Matches packages/ui/src/components/Field.tsx's shared `controlClasses` (not exported — this is
// a compact inline filter, not a labeled form field, so SelectField's visible-label wrapper would
// look wrong here) so this select doesn't visually drift from every other control on the page.
const selectClasses =
  "h-10 rounded-input border border-border bg-surface px-3 font-body text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function RealNotificationsPage() {
  const [channel, setChannel] = useState<RealNotificationChannel | "ALL">("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const query = useNotifications({ channel: channel === "ALL" ? undefined : channel, unreadOnly: unreadOnly || undefined, page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [selected, setSelected] = useState<RealNotification | null>(null);

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
          className={selectClasses}
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
            {items.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                <button
                  type="button"
                  onClick={() => setSelected(n)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-input text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="line-clamp-2 break-words font-body text-sm font-semibold text-text-primary">{n.title}</p>
                    {!n.readAt ? <Badge tone="accent">Yangi</Badge> : null}
                    <Badge tone="neutral">{notificationChannelMeta[n.channel]?.label ?? n.channel}</Badge>
                    {n.channel !== "IN_APP" ? <Badge tone={notificationDeliveryStatusMeta[n.status].tone}>{notificationDeliveryStatusMeta[n.status].label}</Badge> : null}
                  </div>
                  <p className="line-clamp-2 break-words font-body text-xs text-text-secondary">{n.body}</p>
                  <p className="font-body text-xs text-text-muted">{new Date(n.createdAt).toLocaleString("uz-UZ")}</p>
                </button>
                {!n.readAt ? (
                  <Button size="sm" variant="ghost" className="shrink-0" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
                    O&apos;qildi
                  </Button>
                ) : null}
              </li>
            ))}
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

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""} description={selected ? new Date(selected.createdAt).toLocaleString("uz-UZ") : undefined}>
        {selected ? (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap break-words font-body text-sm text-text-secondary">{selected.body}</p>
            {!selected.readAt ? (
              <Button
                size="sm"
                variant="outline"
                disabled={markRead.isPending}
                onClick={() => {
                  markRead.mutate(selected.id);
                  setSelected(null);
                }}
              >
                O&apos;qildi deb belgilash
              </Button>
            ) : null}
          </div>
        ) : null}
      </Dialog>
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
