"use client";

import { useState } from "react";
import { formatMoneyMinor } from "@rosti/types";
import { Badge, DataTableShell } from "@rosti/ui";
import { useAdminPayments } from "@/services/admin/orders";

const STATUS_TONE: Record<string, "success" | "info" | "error" | "neutral"> = {
  PAID: "success",
  PROCESSING: "info",
  PENDING: "neutral",
  FAILED: "error",
  CANCELLED: "neutral",
  REFUNDED: "error",
};

export default function AdminPaymentsPage() {
  const query = useAdminPayments();
  const [search, setSearch] = useState("");

  const filtered = (query.data ?? []).filter((o) => o.customer.fullName.toLowerCase().includes(search.toLowerCase()) || o.offerName.toLowerCase().includes(search.toLowerCase()));

  return (
    <DataTableShell
      title="To'lovlar"
      description="Har bir buyurtmaning to'lov holati va provayder ma'lumoti."
      searchValue={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="To'lov topilmadi"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Offer</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mijoz</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Provider</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Reference</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{o.offerName}</td>
              <td className="px-4 py-2.5 text-text-secondary">{o.customer.fullName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{o.paymentMethod}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric text-xs text-text-muted">TXN-{o.id.slice(-8).toUpperCase()}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(o.totalMinor, o.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={STATUS_TONE[o.paymentStatus] ?? "neutral"}>{o.paymentStatus}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
