"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Badge, DataTableShell } from "@rosti/ui";
import { useAdminRefunds } from "@/services/admin/orders";

export default function AdminRefundsPage() {
  const query = useAdminRefunds();
  const refunds = query.data ?? [];

  return (
    <DataTableShell
      title="Refundlar"
      description="Refund yaratish buyurtma tafsilot sahifasidan amalga oshiriladi va commission uchun avtomatik REVERSAL yozadi."
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={refunds.length === 0}
      emptyTitle="Hali refund yo'q"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyurtma</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Turi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sabab</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {refunds.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/orders/${r.orderId}`} className="font-medium text-text-primary hover:text-accent">
                  #{r.orderPublicToken}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-error">−{formatMoneyMinor(r.amountMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{r.isPartial ? "Qisman" : "To'liq"}</td>
              <td className="px-4 py-2.5 text-text-secondary">{r.reason}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone="success">{r.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
