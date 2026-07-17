"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OrderStatus } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminOrders } from "@/services/admin/orders";
import { orderStatusMeta } from "@/lib/status";

const STATUSES: OrderStatus[] = ["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED", "REFUNDED"];

export default function AdminOrdersPage() {
  const query = useAdminOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (o) =>
          (statusFilter === "ALL" || o.status === statusFilter) &&
          (o.offerName.toLowerCase().includes(search.toLowerCase()) || o.customer.fullName.toLowerCase().includes(search.toLowerCase())),
      ),
    [query.data, search, statusFilter],
  );

  return (
    <DataTableShell
      title="Buyurtmalar"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Offer yoki mijoz bo'yicha qidirish"
      filters={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "ALL")} className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm">
          <option value="ALL">Barcha holatlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {orderStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Buyurtma topilmadi"
      emptyDescription="Buyer /checkout orqali buyurtma qilgach shu yerda ko'rinadi."
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Offer</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mijoz</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Jami</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sana</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-text-primary hover:text-accent">
                  {o.offerName}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{o.customer.fullName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{o.attributedCreatorName ?? "Direct"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(o.totalMinor, o.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={orderStatusMeta[o.status].tone} label={orderStatusMeta[o.status].label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
