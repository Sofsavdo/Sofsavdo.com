"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { AnalyticsFilterBar, DataTableShell, MobileDataCard } from "@rosti/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useCampaignAnalyticsList } from "@/services/admin/analytics";

export default function CampaignAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setPage } = useAnalyticsFilters();
  const query = useCampaignAnalyticsList(filters);

  return (
    <DataTableShell
      title="Campaign Analytics"
      description="Har bir kampaniyaning davr bo'yicha ishlashi — buyurtmalar, tushum, creatorlar soni."
      filters={<AnalyticsFilterBar range={filters.range} onRangeChange={setRange} from={filters.from} to={filters.to} onFromChange={setFrom} onToChange={setTo} compare={filters.compare ?? "none"} onCompareChange={setCompare} />}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Bu davrda kampaniya faolligi topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((c) => (
        <MobileDataCard
          key={c.campaignId}
          href={`/admin/analytics/campaigns/${c.campaignId}`}
          title={c.name}
          meta={<span className="font-body text-xs text-text-secondary">{c.status}</span>}
          fields={[
            { label: "Buyurtmalar", value: c.ordersCount },
            { label: "Creatorlar", value: c.creatorCount },
            { label: "Tushum", value: formatMoneyMinor(c.revenueMinor), emphasis: true },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kampaniya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Buyurtmalar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tushum</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creatorlar</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((c) => (
            <tr key={c.campaignId} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/analytics/campaigns/${c.campaignId}`} className="font-medium text-text-primary hover:text-accent">
                  {c.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.status}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.ordersCount}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-numeric tabular-nums text-text-primary">{formatMoneyMinor(c.revenueMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.creatorCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
