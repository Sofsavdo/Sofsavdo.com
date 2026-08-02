"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RealOrderStatus } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { DataTableShell, MobileDataCard, StatusBadge } from "@sofsavdo/ui";
import { useOrderReviewList, useUpdateRealOrderStatus } from "@/services/admin/orders";
import { realOrderStatusMeta } from "@/lib/status";

const REAL_STATUSES: RealOrderStatus[] = ["CREATED", "PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REFUNDED"];

// Mirrors the order detail page's transitions
const REAL_NEXT_STATUSES: Record<RealOrderStatus, RealOrderStatus[]> = {
  CREATED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

function RealAdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RealOrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const query = useOrderReviewList({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize: 50,
  });
  const updateStatus = useUpdateRealOrderStatus();

  return (
    <DataTableShell
      title="Buyurtmalar"
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Offer, mijoz yoki buyurtma raqami bo'yicha qidirish"
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as RealOrderStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {REAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {realOrderStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Buyurtma topilmadi"
      emptyDescription="Buyer /checkout orqali buyurtma qilgach shu yerda ko'rinadi."
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((o) => (
        <MobileDataCard
          key={o.id}
          href={`/admin/orders/${o.id}`}
          title={o.offer.name}
          meta={<StatusBadge tone={realOrderStatusMeta[o.status].tone} label={realOrderStatusMeta[o.status].label} />}
          fields={[
            { label: "Mijoz", value: o.customer.fullName },
            { label: "Creator", value: o.commission?.creatorName ?? "Direct" },
            { label: "Sana", value: new Date(o.createdAt).toLocaleDateString("uz-UZ") },
            { label: "Jami", value: formatMoneyMinor(o.totalMinor, o.currency), emphasis: true },
          ]}
        />
      ))}
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
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">O'zgartirish</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((o) => {
            const nextStatuses = REAL_NEXT_STATUSES[o.status];
            return (
              <tr key={o.id} className="border-t border-border hover:bg-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-text-primary hover:text-accent">
                    {o.offer.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{o.customer.fullName}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{o.commission?.creatorName ?? "Direct"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(o.totalMinor, o.currency)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusBadge tone={realOrderStatusMeta[o.status].tone} label={realOrderStatusMeta[o.status].label} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {nextStatuses.length > 0 ? (
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value as RealOrderStatus })}
                      disabled={updateStatus.isPending}
                      className="h-8 rounded-input border border-border bg-bg px-2 text-xs font-body"
                    >
                      <option value={o.status}>{realOrderStatusMeta[o.status].label}</option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          → {realOrderStatusMeta[s].label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}

export default function AdminOrdersPage() {
  return <RealAdminOrdersPage />;
}
