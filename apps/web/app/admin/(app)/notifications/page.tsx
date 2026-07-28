"use client";

import { useState } from "react";
import type { RealNotificationChannel, RealNotificationDeliveryStatus } from "@rosti/types";
import { Badge, Button, DataTableShell, MobileDataCard } from "@rosti/ui";
import { useAdminFailedNotificationList, useAdminNotificationList, useRetryAdminNotification } from "@/services/admin/notifications";
import { notificationChannelMeta, notificationDeliveryStatusMeta, notificationTypeMeta } from "@/lib/status";

const CHANNELS: RealNotificationChannel[] = ["IN_APP", "TELEGRAM", "EMAIL"];
const STATUSES: RealNotificationDeliveryStatus[] = ["PENDING", "SENT", "FAILED"];

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<"all" | "failed">("all");
  const [channel, setChannel] = useState<RealNotificationChannel | "ALL">("ALL");
  const [status, setStatus] = useState<RealNotificationDeliveryStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const allQuery = useAdminNotificationList({
    channel: channel === "ALL" ? undefined : channel,
    status: tab === "all" && status !== "ALL" ? status : undefined,
    page,
    pageSize: 20,
  });
  const failedQuery = useAdminFailedNotificationList({ channel: channel === "ALL" ? undefined : channel, page, pageSize: 20 });
  const query = tab === "failed" ? failedQuery : allQuery;
  const retry = useRetryAdminNotification();

  const items = query.data?.items ?? [];

  return (
    <DataTableShell
      title="Bildirishnomalar"
      description="Barcha yuborilgan bildirishnomalar va yetkazib berish holati. Muvaffaqiyatsiz TELEGRAM/EMAIL yuborishlarni qayta urinib ko'rish mumkin."
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-input border border-border p-0.5">
            <Button
              size="sm"
              variant={tab === "all" ? "solid" : "ghost"}
              onClick={() => {
                setTab("all");
                setPage(1);
              }}
            >
              Barchasi
            </Button>
            <Button
              size="sm"
              variant={tab === "failed" ? "solid" : "ghost"}
              onClick={() => {
                setTab("failed");
                setPage(1);
              }}
            >
              Muvaffaqiyatsiz
            </Button>
          </div>
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
          {tab === "all" ? (
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as RealNotificationDeliveryStatus | "ALL");
                setPage(1);
              }}
              className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
            >
              <option value="ALL">Barcha holatlar</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {notificationDeliveryStatusMeta[s].label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle="Bildirishnoma topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={items.map((n) => (
        <MobileDataCard
          key={n.id}
          title={notificationTypeMeta[n.type]?.label ?? n.type}
          meta={<Badge tone={notificationDeliveryStatusMeta[n.status].tone}>{notificationDeliveryStatusMeta[n.status].label}</Badge>}
          fields={[
            { label: "Qabul qiluvchi", value: n.user.email ?? n.user.phone ?? n.user.id },
            { label: "Kanal", value: notificationChannelMeta[n.channel]?.label ?? n.channel },
            { label: "Sana", value: new Date(n.createdAt).toLocaleDateString("uz-UZ") },
          ]}
          actions={
            n.status === "FAILED" ? (
              <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate(n.id)}>
                Qayta urinish
              </Button>
            ) : undefined
          }
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Turi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Qabul qiluvchi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kanal</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Urinishlar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sana</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{notificationTypeMeta[n.type]?.label ?? n.type}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{n.user.email ?? n.user.phone ?? n.user.id}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone="neutral">{notificationChannelMeta[n.channel]?.label ?? n.channel}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={notificationDeliveryStatusMeta[n.status].tone}>{notificationDeliveryStatusMeta[n.status].label}</Badge>
                {n.status === "FAILED" && n.error ? <p className="mt-1 max-w-xs truncate text-xs text-error" title={n.error}>{n.error}</p> : null}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{n.attempts}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(n.createdAt).toLocaleString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {n.status === "FAILED" ? (
                  <Button size="sm" disabled={retry.isPending} onClick={() => retry.mutate(n.id)}>
                    Qayta urinish
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
