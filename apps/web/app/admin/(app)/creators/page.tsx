"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminCreators } from "@/services/admin/creators";
import { applicationStatusMeta, creatorAccountStatusMeta } from "@/lib/status";

export default function AdminCreatorsPage() {
  const query = useAdminCreators();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (query.data ?? []).filter((u) => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search.toLowerCase())),
    [query.data, search],
  );

  return (
    <DataTableShell
      title="Creatorlar"
      description="Barcha creator hisoblari — onboarding holatidan qat'iy nazar."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Ism yoki email bo'yicha qidirish"
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Creator topilmadi"
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
          {filtered.map((u) => (
            <tr key={u.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/creators/${u.id}`} className="font-medium text-text-primary hover:text-accent">
                  {u.displayName}
                </Link>
                <p className="font-body text-xs text-text-muted">{u.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{u.application.data.city ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={applicationStatusMeta[u.application.status].tone} label={applicationStatusMeta[u.application.status].label} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge
                  tone={creatorAccountStatusMeta[u.accountStatus ?? "ACTIVE"].tone}
                  label={creatorAccountStatusMeta[u.accountStatus ?? "ACTIVE"].label}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
