"use client";

import { useState } from "react";
import type { RealNotification } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Skeleton } from "@sofsavdo/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/services/notifications";

// Reuses the exact same backend endpoints as the creator notifications page (GET
// /creator/notifications*) — that domain is already ownership-scoped by userId, not
// creator-specific despite the URL prefix (see CreatorNotificationsController's own comment), so
// no new backend route was needed for a buyer to see their own notifications.
export default function BuyerNotificationsPage() {
  // channel: "IN_APP" only — the same business event also creates an EMAIL (and potentially
  // TELEGRAM) row for delivery bookkeeping (see NotificationsService.dispatchToUser), which the
  // creator page surfaces deliberately via its channel Badge. A buyer has no reason to see
  // "the same message, twice" with no explanation of why — that reads as a bug, not a feature.
  const query = useNotifications({ pageSize: 20, channel: "IN_APP" });
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
        <Button size="sm" variant="outline" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          Barchasini o&apos;qilgan deb belgilash
        </Button>
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
