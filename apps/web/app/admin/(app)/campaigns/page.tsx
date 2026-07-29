"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, DataTableShell, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useAdminCampaigns } from "@/services/admin/campaigns";
import { campaignStatusMeta } from "@/lib/status";
import { formatCommission } from "@/lib/commission-display";

export default function AdminCampaignsPage() {
  const query = useAdminCampaigns();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (query.data ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  );

  return (
    <DataTableShell
      title="Campaigns"
      description="Creatorlar uchun reklama kampaniyalari — har biri bitta Offer asosida."
      searchValue={search}
      onSearchChange={setSearch}
      actions={
        <Button asChild size="sm">
          <Link href="/admin/campaigns/new">
            <Plus className="mr-1.5 size-4" /> Yangi campaign
          </Link>
        </Button>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Campaign topilmadi"
      mobileCards={filtered.map((c) => (
        <MobileDataCard
          key={c.id}
          href={`/admin/campaigns/${c.id}`}
          title={c.name}
          meta={<StatusBadge tone={campaignStatusMeta[c.status].tone} label={campaignStatusMeta[c.status].label} />}
          fields={[
            { label: "Offer", value: c.offer.name },
            { label: "Komissiya", value: formatCommission(c) },
            { label: "Creatorlar", value: `${c.approvedCreatorCount}/${c.creatorLimit}`, emphasis: true },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kampaniya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Offer</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Komissiya</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Creatorlar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-text-primary hover:text-accent">
                  {c.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.offer.name}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{formatCommission(c)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">
                {c.approvedCreatorCount}/{c.creatorLimit}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={campaignStatusMeta[c.status].tone} label={campaignStatusMeta[c.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
