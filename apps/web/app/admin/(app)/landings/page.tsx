"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminOffers } from "@/services/admin/catalog";
import { offerStatusMeta } from "@/lib/status";

export default function AdminLandingsPage() {
  const query = useAdminOffers();
  const [search, setSearch] = useState("");

  const filtered = (query.data ?? []).filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DataTableShell
      title="Landing sahifalar"
      description="Har bir offer uchun modular section-builder — buyer sahifasi bilan bir xil componentlar."
      searchValue={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Offer topilmadi"
    >
      <ul className="divide-y divide-border">
        {filtered.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-body text-sm font-medium text-text-primary">{o.name}</p>
              <p className="font-body text-xs text-text-muted">/o/{o.slug}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge tone={offerStatusMeta[o.status].tone} label={offerStatusMeta[o.status].label} />
              <Link href={`/admin/landings/${o.id}`} className="inline-flex items-center gap-1.5 font-body text-sm text-accent underline">
                <LayoutTemplate className="size-4" /> Builder
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </DataTableShell>
  );
}
