"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminReferrals } from "@/services/admin/referrals";
import { referralActivityMeta } from "@/lib/status";
import type { ReferralActivityClass } from "@/lib/api/admin";

const ACTIVITY_FILTERS: ReferralActivityClass[] = [
  "NEW",
  "ONBOARDING_STALLED",
  "AWAITING_APPROVAL",
  "APPROVED_INACTIVE",
  "ACTIVE_NO_EARNINGS",
  "EARNING",
  "DORMANT",
];

export function CreatorReferralsPageClient() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<ReferralActivityClass | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const referrerCreatorId = searchParams.get("referrerCreatorId") ?? undefined;

  const query = useAdminReferrals({
    page,
    pageSize: 20,
    search: search || undefined,
    activity: activity === "ALL" ? undefined : activity,
    referrerCreatorId,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <DataTableShell
      title="Creator referrallari"
      description="Creatorlar tomonidan taklif qilingan yangi creatorlar va ularning faoliyati."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Referrer yoki referred creator ismi bo'yicha qidirish"
      filters={
        <select
          value={activity}
          onChange={(e) => {
            setActivity(e.target.value as ReferralActivityClass | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {ACTIVITY_FILTERS.map((a) => (
            <option key={a} value={a}>
              {referralActivityMeta[a].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle="Referral topilmadi"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Referrer</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Taklif qilingan creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ro&apos;yxatdan o&apos;tgan</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Faoliyat</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Arizalar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mukofotlar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{r.referrer.displayName}</td>
              <td className="px-4 py-2.5">
                <Link href={`/admin/creator-referrals/${r.id}`} className="font-medium text-text-primary hover:text-accent">
                  {r.referred.displayName}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{new Date(r.registeredAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={referralActivityMeta[r.activity].tone} label={referralActivityMeta[r.activity].label} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-secondary">
                {r.approvedCampaignApplicationCount}/{r.campaignApplicationCount}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                {r.rewards.length === 0 ? "—" : `${r.rewards.length} ta`}
                {r.disqualifiedAt ? <span className="ml-1 text-error">(diskvalifikatsiya)</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border p-3">
          <p className="font-body text-xs text-text-muted">
            {query.data?.total ?? 0} ta referral · {page}/{totalPages}-sahifa
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
