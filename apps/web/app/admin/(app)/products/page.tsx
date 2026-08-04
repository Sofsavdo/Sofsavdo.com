"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTableShell, Button, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useAdminProducts } from "@/services/admin/catalog";
import { productStatusMeta } from "@/lib/status";

const TYPE_LABELS: Record<string, string> = {
  PHYSICAL_PRODUCT: "Fizik mahsulot",
  DIGITAL_PRODUCT: "Raqamli mahsulot",
  COURSE: "Kurs",
  SERVICE: "Xizmat",
  CONSULTATION: "Konsultatsiya",
};

export default function AdminProductsPage() {
  const query = useAdminProducts();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (query.data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  );

  return (
    <DataTableShell
      title="Mahsulotlar"
      description="Sotiladigan mahsulotlaringiz."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Mahsulot nomi bo'yicha qidirish"
      actions={
        <Button asChild size="sm">
          <Link href="/admin/products/launch">
            <Plus className="mr-1.5 size-4" /> Yangi mahsulot
          </Link>
        </Button>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Mahsulot topilmadi"
      emptyDescription="Filtrni o'zgartiring yoki yangi mahsulot qo'shing."
      mobileCards={filtered.map((p) => (
        <MobileDataCard
          key={p.id}
          href={`/admin/products/${p.id}`}
          title={p.name}
          meta={<StatusBadge tone={productStatusMeta[p.status].tone} label={productStatusMeta[p.status].label} />}
          fields={[
            { label: "Turi", value: TYPE_LABELS[p.type] ?? p.type },
            { label: "Kod", value: p.sku ?? "—" },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Nomi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Turi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kod</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/products/${p.id}`} className="font-medium text-text-primary hover:text-accent">
                  {p.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.sku ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={productStatusMeta[p.status].tone} label={productStatusMeta[p.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
