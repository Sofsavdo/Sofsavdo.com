"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Pin, PinOff, Plus } from "lucide-react";
import { Badge, DataTableShell, Button, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useAdminProducts, usePinProduct, useUnpinProduct } from "@/services/admin/catalog";
import { productStatusMeta } from "@/lib/status";
import type { Product } from "@sofsavdo/types";

const TYPE_LABELS: Record<string, string> = {
  PHYSICAL_PRODUCT: "Fizik mahsulot",
  DIGITAL_PRODUCT: "Raqamli mahsulot",
  COURSE: "Kurs",
  SERVICE: "Xizmat",
  CONSULTATION: "Konsultatsiya",
};

const BADGE_LABELS: Record<string, string> = { PREMIUM: "Premium", VIP: "VIP" };

function PinToggle({ product }: { product: Product }) {
  const pin = usePinProduct();
  const unpin = useUnpinProduct();
  const pending = pin.isPending || unpin.isPending;

  function onClick(e: MouseEvent) {
    // These render inside MobileDataCard's own <a href> wrapper on mobile — without this, the
    // click bubbles up and triggers a full-page navigation to the product instead of toggling.
    e.preventDefault();
    e.stopPropagation();
    if (product.isPinned) unpin.mutate(product.id);
    else pin.mutate(product.id);
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={onClick} aria-label={product.isPinned ? "Pindan yechish" : "Yuqoriga pinlash"}>
      {product.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
    </Button>
  );
}

export default function AdminProductsPage() {
  const query = useAdminProducts();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const matches = (query.data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    // Pinned products float to the top here too — same ordering the creator-facing product
    // picker uses (Array.prototype.sort is a stable sort, so relative order is otherwise kept).
    return [...matches].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [query.data, search]);

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
          title={
            <span className="flex items-center gap-1.5">
              {p.isPinned ? <Pin className="size-3.5 shrink-0 text-accent" /> : null}
              {p.name}
            </span>
          }
          meta={
            <div className="flex items-center gap-1.5">
              {p.featuredBadge ? <Badge tone="accent">{BADGE_LABELS[p.featuredBadge] ?? p.featuredBadge}</Badge> : null}
              <StatusBadge tone={productStatusMeta[p.status].tone} label={productStatusMeta[p.status].label} />
            </div>
          }
          fields={[
            { label: "Turi", value: TYPE_LABELS[p.type] ?? p.type },
            { label: "Kod", value: p.sku ?? "—" },
          ]}
          actions={<PinToggle product={p} />}
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
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-1.5 font-medium text-text-primary hover:text-accent">
                    {p.isPinned ? <Pin className="size-3.5 shrink-0 text-accent" /> : null}
                    {p.name}
                  </Link>
                  {p.featuredBadge ? <Badge tone="accent">{BADGE_LABELS[p.featuredBadge] ?? p.featuredBadge}</Badge> : null}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{TYPE_LABELS[p.type] ?? p.type}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.sku ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={productStatusMeta[p.status].tone} label={productStatusMeta[p.status].label} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <PinToggle product={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
