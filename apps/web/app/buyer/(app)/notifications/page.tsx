"use client";

import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "@sofsavdo/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/services/notifications";
import { notificationTypeMeta } from "@/lib/status";

// Reuses the exact same backend endpoints as the creator notifications page (GET
// /creator/notifications*) — that domain is already ownership-scoped by userId, not
// creator-specific despite the URL prefix (see CreatorNotificationsController's own comment), so
// no new backend route was needed for a buyer to see their own notifications.
export default function BuyerNotificationsPage() {
  const query = useNotifications({ pageSize: 20 });
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
            {items.map((n) => {
              const meta = notificationTypeMeta[n.type] ?? { label: n.type, tone: "neutral" as const };
              return (
                <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-body text-sm font-semibold text-text-primary">{meta.label}</p>
                      {!n.readAt ? <Badge tone="accent">Yangi</Badge> : null}
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
        </Card>
      )}
    </div>
  );
}
