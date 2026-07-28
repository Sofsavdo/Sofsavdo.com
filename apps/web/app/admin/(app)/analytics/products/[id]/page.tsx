"use client";

import { useParams } from "next/navigation";
import { formatMoneyMinor } from "@rosti/types";
import { AnalyticsFilterBar, Skeleton, StatTile } from "@rosti/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useProductAnalyticsDetail } from "@/services/admin/analytics";
import { RevenueTrendChart } from "@/components/admin/AnalyticsCharts";

export default function ProductAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, setRange, setFrom, setTo, setCompare } = useAnalyticsFilters();
  const query = useProductAnalyticsDetail(id, filters);

  if (query.isLoading || !query.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const d = query.data;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">{d.name}</h1>

      <AnalyticsFilterBar range={filters.range} onRangeChange={setRange} from={filters.from} to={filters.to} onFromChange={setFrom} onToChange={setTo} compare={filters.compare ?? "none"} onCompareChange={setCompare} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Buyurtmalar" value={d.ordersCount} />
        <StatTile label="Tushum" value={formatMoneyMinor(d.revenueMinor)} />
        <StatTile label="Refundlar" value={formatMoneyMinor(d.refundsMinor)} />
        <StatTile label="Refund qilingan buyurtmalar" value={d.refundedOrdersCount} />
        <StatTile label="Kliklar" value={d.clicksCount} />
        <StatTile label="Konversiya" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        <StatTile label="O'rtacha buyurtma (AOV)" value={formatMoneyMinor(d.averageOrderValueMinor)} />
      </div>

      <RevenueTrendChart trend={d.trend} />
    </div>
  );
}
