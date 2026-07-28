"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { AnalyticsFilterBar, DataTableShell, MobileDataCard, cn } from "@rosti/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useProductAnalyticsList } from "@/services/admin/analytics";

export default function ProductAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setPage, setFilter } = useAnalyticsFilters();
  const query = useProductAnalyticsList(filters);
  const sortDir = filters.sortDir ?? "desc";

  return (
    <DataTableShell
      title="Product Analytics"
      description="Eng ko'p sotilgan (best seller) va sekin sotilayotgan (slow mover) mahsulotlar — bitta ro'yxat, ikki yo'nalishda saralash."
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <AnalyticsFilterBar range={filters.range} onRangeChange={setRange} from={filters.from} to={filters.to} onFromChange={setFrom} onToChange={setTo} compare={filters.compare ?? "none"} onCompareChange={setCompare} />
          <div className="flex gap-1 rounded-input bg-bg p-1">
            <button
              type="button"
              onClick={() => setFilter("sortDir", "desc")}
              className={cn("rounded-input px-3 py-1.5 font-body text-sm transition-colors", sortDir === "desc" ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary")}
            >
              Eng ko&apos;p sotilgan
            </button>
            <button
              type="button"
              onClick={() => setFilter("sortDir", "asc")}
              className={cn("rounded-input px-3 py-1.5 font-body text-sm transition-colors", sortDir === "asc" ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary")}
            >
              Sekin sotilayotgan
            </button>
          </div>
        </div>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Bu davrda mahsulot faolligi topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((p) => (
        <MobileDataCard
          key={p.productId}
          href={`/admin/analytics/products/${p.productId}`}
          title={p.name}
          fields={[
            { label: "Buyurtmalar", value: p.ordersCount },
            { label: "AOV", value: formatMoneyMinor(p.averageOrderValueMinor) },
            { label: "Refundlar", value: formatMoneyMinor(p.refundsMinor) },
            { label: "Tushum", value: formatMoneyMinor(p.revenueMinor), emphasis: true },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mahsulot</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyurtmalar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tushum</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Refundlar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">AOV</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((p) => (
            <tr key={p.productId} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/analytics/products/${p.productId}`} className="font-medium text-text-primary hover:text-accent">
                  {p.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.ordersCount}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-primary">{formatMoneyMinor(p.revenueMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(p.refundsMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(p.averageOrderValueMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
