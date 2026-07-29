"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Badge, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useRealRefundList } from "@/services/admin/orders";

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  REQUESTED: "warning",
  APPROVED: "success",
  PROCESSED: "success",
  REJECTED: "error",
};

const STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "REJECTED"];

export default function AdminRefundsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const query = useRealRefundList({ search: search || undefined, status: status === "ALL" ? undefined : (status as never), page, pageSize: 20 });

  return (
    <DataTableShell
      title="Refundlar"
      description="Refund yaratish buyurtma tafsilot sahifasidan amalga oshiriladi; bu yerda ko'rib chiqish qarori qabul qilinadi."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Buyurtma raqami yoki mijoz ismi"
      filters={
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Hali refund yo'q"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((r) => (
        <MobileDataCard
          key={r.id}
          href={`/admin/refunds/${r.id}`}
          title={`#${r.orderPublicToken}`}
          meta={<Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>}
          fields={[
            { label: "Mijoz", value: r.customerName },
            { label: "Turi", value: r.isPartial ? "Qisman" : "To'liq" },
            { label: "Summa", value: `−${formatMoneyMinor(r.amountMinor)}`, emphasis: true },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyurtma</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mijoz</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Turi</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/refunds/${r.id}`} className="font-medium text-text-primary hover:text-accent">
                  #{r.orderPublicToken}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text-secondary">{r.customerName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-error">−{formatMoneyMinor(r.amountMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{r.isPartial ? "Qisman" : "To'liq"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
