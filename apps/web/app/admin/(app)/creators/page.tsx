"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { DataTableShell, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useRealCreatorActivitySummary, useRealCreatorList } from "@/services/admin/creators";
import { creatorAccountStatusMeta, creatorActivityStatusMeta } from "@/lib/status";
import type { CreatorActivityStatus, RealUserStatus } from "@sofsavdo/types";

// Compact "N kun oldin" so an admin can eyeball dormancy at a glance.
function daysAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Bugun";
  if (days === 1) return "Kecha";
  return `${days} kun oldin`;
}

const ACTIVITY_FILTERS: { value: CreatorActivityStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Barcha faollik" },
  { value: "NO_FLOW", label: "⚠️ Oqim olmagan" },
  { value: "FLOW_NO_CLICKS", label: "⚠️ Harakatsiz" },
  { value: "ACTIVE_NO_EARNINGS", label: "Faol" },
  { value: "EARNING", label: "Daromadli" },
  { value: "NEW", label: "Yangi" },
];

export default function AdminCreatorsPage() {
  const [search, setSearch] = useState("");
  const [activityStatus, setActivityStatus] = useState<CreatorActivityStatus | "ALL">("ALL");
  const [accountStatus, setAccountStatus] = useState<RealUserStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const summaryQuery = useRealCreatorActivitySummary();
  const query = useRealCreatorList({
    search: search || undefined,
    activityStatus: activityStatus === "ALL" ? undefined : activityStatus,
    accountStatus: accountStatus === "ALL" ? undefined : accountStatus,
    page,
    pageSize: 20,
  });

  const s = summaryQuery.data;
  // Clicking a funnel tile filters the list to that bucket — the whole point is one-click triage.
  const tiles: { key: CreatorActivityStatus | "ALL"; label: string; value: number | undefined; tone: string }[] = [
    { key: "ALL", label: "Jami creator", value: s?.total, tone: "text-text-primary" },
    { key: "NO_FLOW", label: "⚠️ Oqim olmagan", value: s?.noFlow, tone: "text-warning" },
    { key: "FLOW_NO_CLICKS", label: "⚠️ Harakatsiz", value: s?.flowNoClicks, tone: "text-warning" },
    { key: "EARNING", label: "Daromadli", value: s?.earning, tone: "text-success" },
  ];

  return (
    <DataTableShell
      title="Creatorlar"
      description="Kim oqim olib ishlayapti, kim ro'yxatdan o'tib to'xtab qolgan — bir joyda."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Ism, email yoki shahar bo'yicha qidirish"
      filters={
        <div className="flex flex-wrap gap-2">
          <select
            value={activityStatus}
            onChange={(e) => {
              setActivityStatus(e.target.value as CreatorActivityStatus | "ALL");
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          >
            {ACTIVITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={accountStatus}
            onChange={(e) => {
              setAccountStatus(e.target.value as RealUserStatus | "ALL");
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          >
            <option value="ALL">Barcha hisob holatlari</option>
            <option value="ACTIVE">Faol</option>
            <option value="SUSPENDED">To&apos;xtatilgan</option>
            <option value="BLOCKED">Bloklangan</option>
          </select>
        </div>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Creator topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((c) => {
        const accountMeta = creatorAccountStatusMeta[c.accountStatus === "DELETED" ? "BLOCKED" : c.accountStatus];
        const actMeta = creatorActivityStatusMeta[c.activityStatus];
        return (
          <MobileDataCard
            key={c.id}
            href={`/admin/creators/${c.id}`}
            title={c.displayName}
            meta={<StatusBadge tone={actMeta.tone} label={actMeta.label} />}
            fields={[
              { label: "Telefon", value: c.phone ?? "—" },
              { label: "Shahar", value: c.city ?? "—" },
              { label: "Oqimlar", value: String(c.flowCount) },
              { label: "Daromad", value: formatMoneyMinor(c.totalEarnedMinor, "UZS") },
              { label: "Oxirgi faollik", value: daysAgoLabel(c.lastActivityAt) },
              { label: "Hisob", value: <StatusBadge tone={accountMeta.tone} label={accountMeta.label} /> },
            ]}
          />
        );
      })}
    >
      {/* Funnel snapshot — click a tile to filter the list below to that bucket. */}
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActivityStatus(t.key);
              setPage(1);
            }}
            className={`rounded-card border px-4 py-3 text-left transition-colors hover:border-accent ${
              activityStatus === t.key ? "border-accent bg-bg" : "border-border"
            }`}
          >
            <p className="font-body text-xs text-text-secondary">{t.label}</p>
            <p className={`mt-1 font-numeric text-2xl font-bold tabular-nums ${t.tone}`}>
              {summaryQuery.isLoading ? "…" : (t.value ?? 0)}
            </p>
          </button>
        ))}
      </div>

      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Faollik</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Oqimlar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Bosilish / Buyurtma</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Daromad</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Oxirgi faollik</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Hisob</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Amal</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((c) => {
            const actMeta = creatorActivityStatusMeta[c.activityStatus];
            const accountMeta = creatorAccountStatusMeta[c.accountStatus === "DELETED" ? "BLOCKED" : c.accountStatus];
            return (
              <tr key={c.id} className="border-t border-border hover:bg-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/creators/${c.id}`} className="font-medium text-text-primary hover:text-accent">
                    {c.displayName}
                  </Link>
                  <p className="font-body text-xs text-text-muted">{c.phone ?? c.email ?? "—"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusBadge tone={actMeta.tone} label={actMeta.label} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-secondary">{c.flowCount}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-secondary">
                  {c.totalClicks} / {c.totalOrders}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-primary">
                  {formatMoneyMinor(c.totalEarnedMinor, "UZS")}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{daysAgoLabel(c.lastActivityAt)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusBadge tone={accountMeta.tone} label={accountMeta.label} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Link href={`/admin/chat?creatorId=${c.id}`} className="font-body text-sm text-accent hover:underline">
                    💬 Xabar
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
