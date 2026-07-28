"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTableShell, MobileDataCard, StatusBadge } from "@rosti/ui";
import { useRealCreatorList } from "@/services/admin/creators";
import { applicationStatusMeta, creatorAccountStatusMeta } from "@/lib/status";
import type { CreatorApplicationStatus, RealUserStatus } from "@rosti/types";

export default function AdminCreatorsPage() {
  const [search, setSearch] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<CreatorApplicationStatus | "ALL">("ALL");
  const [accountStatus, setAccountStatus] = useState<RealUserStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const query = useRealCreatorList({
    search: search || undefined,
    onboardingStatus: onboardingStatus === "ALL" ? undefined : onboardingStatus,
    accountStatus: accountStatus === "ALL" ? undefined : accountStatus,
    page,
    pageSize: 20,
  });

  return (
    <DataTableShell
      title="Creatorlar"
      description="Barcha creator hisoblari — onboarding holatidan qat'iy nazar."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Ism, email yoki shahar bo'yicha qidirish"
      filters={
        <div className="flex gap-2">
          <select
            value={onboardingStatus}
            onChange={(e) => {
              setOnboardingStatus(e.target.value as CreatorApplicationStatus | "ALL");
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          >
            <option value="ALL">Barcha ariza holatlari</option>
            <option value="SUBMITTED">Yuborildi</option>
            <option value="UNDER_REVIEW">Ko&apos;rib chiqilmoqda</option>
            <option value="CHANGES_REQUESTED">Tuzatish talab qilinadi</option>
            <option value="APPROVED">Tasdiqlangan</option>
            <option value="REJECTED">Rad etilgan</option>
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
        return (
          <MobileDataCard
            key={c.id}
            href={`/admin/creators/${c.id}`}
            title={c.displayName}
            meta={<StatusBadge tone={accountMeta.tone} label={accountMeta.label} />}
            fields={[
              { label: "Email", value: c.email },
              { label: "Shahar", value: c.city ?? "—" },
              {
                label: "Ariza holati",
                value: <StatusBadge tone={applicationStatusMeta[c.onboardingStatus].tone} label={applicationStatusMeta[c.onboardingStatus].label} />,
              },
            ]}
          />
        );
      })}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Shahar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ariza holati</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Hisob holati</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/creators/${c.id}`} className="font-medium text-text-primary hover:text-accent">
                  {c.displayName}
                </Link>
                <p className="font-body text-xs text-text-muted">{c.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.city ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={applicationStatusMeta[c.onboardingStatus].tone} label={applicationStatusMeta[c.onboardingStatus].label} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {(() => {
                  const meta = creatorAccountStatusMeta[c.accountStatus === "DELETED" ? "BLOCKED" : c.accountStatus];
                  return <StatusBadge tone={meta.tone} label={meta.label} />;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
