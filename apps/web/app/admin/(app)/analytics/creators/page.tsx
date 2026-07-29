"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { AnalyticsFilterBar, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useCreatorAnalyticsList } from "@/services/admin/analytics";
import { CampaignFilterSelect } from "@/components/admin/AnalyticsEntityFilters";

export default function CreatorAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setPage, setFilter } = useAnalyticsFilters();
  const query = useCreatorAnalyticsList(filters);

  return (
    <DataTableShell
      title="Creator Analytics"
      description="Har bir creatorning davr bo'yicha ishlashi — buyurtmalar, tushum, klik va konversiya."
      filters={
        <AnalyticsFilterBar
          range={filters.range}
          onRangeChange={setRange}
          from={filters.from}
          to={filters.to}
          onFromChange={setFrom}
          onToChange={setTo}
          compare={filters.compare ?? "none"}
          onCompareChange={setCompare}
          extra={<CampaignFilterSelect value={filters.campaignId} onChange={(v) => setFilter("campaignId", v)} />}
        />
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Bu davrda creator faolligi topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((c) => (
        <MobileDataCard
          key={c.creatorId}
          href={`/admin/analytics/creators/${c.creatorId}`}
          title={c.displayName}
          fields={[
            { label: "Buyurtmalar", value: c.ordersCount },
            { label: "Kliklar", value: c.clicksCount },
            { label: "Konversiya", value: `${(c.conversionRate * 100).toFixed(1)}%` },
            { label: "Tushum", value: formatMoneyMinor(c.revenueMinor), emphasis: true },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyurtmalar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tushum</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kliklar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Konversiya</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((c) => (
            <tr key={c.creatorId} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/analytics/creators/${c.creatorId}`} className="font-medium text-text-primary hover:text-accent">
                  {c.displayName}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.ordersCount}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-primary">{formatMoneyMinor(c.revenueMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.clicksCount}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{(c.conversionRate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
