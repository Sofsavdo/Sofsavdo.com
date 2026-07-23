"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CampaignApplicationStatus } from "@rosti/types";
import { Alert, Button, DataTableShell, StatusBadge } from "@rosti/ui";
import { useCampaignApplicationList } from "@/services/admin/campaign-applications";
import { campaignApplicationStatusMeta } from "@/lib/status";
import { platformLabel } from "@/lib/commission-display";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

// Real lifecycle statuses only — "PENDING" is mock-mode legacy and never comes from the backend.
const FILTER_STATUSES: CampaignApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "WITHDRAWN"];

export function CampaignApplicationsPageClient() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<CampaignApplicationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const campaignId = searchParams.get("campaignId") ?? undefined;

  const query = useCampaignApplicationList({
    page,
    pageSize: 20,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    campaignId,
    search: search || undefined,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <DataTableShell
      title="Kampaniya arizalari"
      description="Creatorlarning kampaniyalarga topshirgan arizalarini ko'rib chiqish."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Creator yoki kampaniya nomi bo'yicha qidirish"
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CampaignApplicationStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {FILTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {campaignApplicationStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle={USE_REAL_API ? "Ariza topilmadi" : "Kampaniya arizalari faqat real API rejimida"}
    >
      {campaignId ? (
        <div className="border-b border-border p-3">
          <Alert tone="info">
            Bitta kampaniya bo&apos;yicha filtrlangan.{" "}
            <Link href="/admin/campaign-applications" className="underline">
              Barcha arizalarni ko&apos;rish
            </Link>
          </Alert>
        </div>
      ) : null}
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kampaniya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Platforma</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Obunachilar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Yuborilgan</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/campaign-applications/${a.id}`} className="font-medium text-text-primary hover:text-accent">
                  {a.creator.displayName}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{a.campaign.name}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{a.platform ? platformLabel(a.platform) : "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-secondary">
                {a.followerSnapshot?.toLocaleString("uz-UZ") ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("uz-UZ") : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={campaignApplicationStatusMeta[a.status].tone} label={campaignApplicationStatusMeta[a.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border p-3">
          <p className="font-body text-xs text-text-muted">
            {query.data?.total ?? 0} ta ariza · {page}/{totalPages}-sahifa
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Oldingi
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Keyingi
            </Button>
          </div>
        </div>
      ) : null}
    </DataTableShell>
  );
}
