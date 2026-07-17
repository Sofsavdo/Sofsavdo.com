"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatMoneyMinor } from "@rosti/types";
import { Button, DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminOffers, useAdminProducts } from "@/services/admin/catalog";
import { offerStatusMeta } from "@/lib/status";

export default function AdminOffersPage() {
  const offersQuery = useAdminOffers();
  const productsQuery = useAdminProducts();
  const [search, setSearch] = useState("");

  const productNameById = useMemo(() => new Map((productsQuery.data ?? []).map((p) => [p.id, p.name])), [productsQuery.data]);

  const filtered = useMemo(
    () => (offersQuery.data ?? []).filter((o) => o.name.toLowerCase().includes(search.toLowerCase())),
    [offersQuery.data, search],
  );

  return (
    <DataTableShell
      title="Offers"
      description="Har bir Product uchun bir nechta sotuv taklifi bo'lishi mumkin."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Offer nomi bo'yicha qidirish"
      actions={
        <Button asChild size="sm">
          <Link href="/admin/offers/new">
            <Plus className="mr-1.5 size-4" /> Yangi offer
          </Link>
        </Button>
      }
      isLoading={offersQuery.isLoading}
      isError={offersQuery.isError}
      onRetry={() => offersQuery.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Offer topilmadi"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Offer</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Product</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Narx</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/offers/${o.id}`} className="font-medium text-text-primary hover:text-accent">
                  {o.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{productNameById.get(o.productId) ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">
                {formatMoneyMinor(o.priceMinor, o.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={offerStatusMeta[o.status].tone} label={offerStatusMeta[o.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
