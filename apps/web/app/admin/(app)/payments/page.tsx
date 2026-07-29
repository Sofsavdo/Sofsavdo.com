"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Badge, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useRealPaymentList } from "@/services/admin/orders";

const STATUS_TONE: Record<string, "success" | "info" | "error" | "neutral"> = {
  PAID: "success",
  PROCESSING: "info",
  PENDING: "neutral",
  FAILED: "error",
  CANCELLED: "neutral",
  REFUNDED: "error",
};

const PROVIDERS = ["CLICK", "PAYME", "UZUM_NASIYA", "CARD", "CASH_ON_DELIVERY", "MANUAL"];
const STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [page, setPage] = useState(1);

  const query = useRealPaymentList({
    search: search || undefined,
    status: status === "ALL" ? undefined : (status as never),
    provider: provider === "ALL" ? undefined : (provider as never),
    page,
    pageSize: 20,
  });

  return (
    <DataTableShell
      title="To'lovlar"
      description="Har bir buyurtmaning to'lov holati va provayder ma'lumoti. Faqat ko'rish uchun."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Buyurtma raqami yoki mijoz ismi"
      filters={
        <div className="flex gap-2">
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
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          >
            <option value="ALL">Barcha provayderlar</option>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="To'lov topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((p) => (
        <MobileDataCard
          key={p.id}
          href={`/admin/payments/${p.id}`}
          title={p.order.offerName}
          meta={<Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>}
          fields={[
            { label: "Mijoz", value: p.order.customerName },
            { label: "Provider", value: p.provider },
            { label: "Reference", value: p.order.publicToken.slice(-8).toUpperCase() },
            { label: "Summa", value: formatMoneyMinor(p.amountMinor, p.currency), emphasis: true },
          ]}
        />
      ))}
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
          {(query.data?.items ?? []).map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/payments/${p.id}`} className="font-medium text-text-primary hover:text-accent">
                  {p.order.offerName}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text-secondary">{p.order.customerName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.provider}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric text-xs text-text-muted">{p.order.publicToken.slice(-8).toUpperCase()}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(p.amountMinor, p.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
