"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, DataTableShell, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useAdminCompetitions } from "@/services/admin/competitions";
import { competitionStatusMeta } from "@/lib/status";

export default function AdminCompetitionsPage() {
  const query = useAdminCompetitions();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (query.data?.items ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  );

  return (
    <DataTableShell
      title="Musobaqalar"
      description="Creatorlar uchun vaqtga bog'liq motivatsion musobaqalar."
      searchValue={search}
      onSearchChange={setSearch}
      actions={
        <Button asChild size="sm">
          <Link href="/admin/competitions/new">
            <Plus className="mr-1.5 size-4" /> Yangi musobaqa
          </Link>
        </Button>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Musobaqa topilmadi"
      mobileCards={filtered.map((c) => (
        <MobileDataCard
          key={c.id}
          href={`/admin/competitions/${c.id}`}
          title={c.name}
          meta={<StatusBadge tone={competitionStatusMeta[c.status].tone} label={competitionStatusMeta[c.status].label} />}
          fields={[
            { label: "Boshlanish", value: new Date(c.startAt).toLocaleDateString("uz-UZ") },
            { label: "Tugash", value: new Date(c.endAt).toLocaleDateString("uz-UZ") },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Musobaqa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Boshlanish</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tugash</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/competitions/${c.id}`} className="font-medium text-text-primary hover:text-accent">
                  {c.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{new Date(c.startAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{new Date(c.endAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={competitionStatusMeta[c.status].tone} label={competitionStatusMeta[c.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
