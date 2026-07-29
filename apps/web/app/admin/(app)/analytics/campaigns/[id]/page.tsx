"use client";

import { useParams } from "next/navigation";
import { formatMoneyMinor } from "@sofsavdo/types";
import { AnalyticsFilterBar, Card, CardHeader, CardTitle, Skeleton, StatTile } from "@sofsavdo/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useCampaignAnalyticsDetail } from "@/services/admin/analytics";
import { RevenueTrendChart } from "@/components/admin/AnalyticsCharts";

export default function CampaignAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, setRange, setFrom, setTo, setCompare } = useAnalyticsFilters();
  const query = useCampaignAnalyticsDetail(id, filters);

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
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">{d.name}</h1>
        <p className="font-body text-sm text-text-secondary">{d.status}</p>
      </div>

      <AnalyticsFilterBar range={filters.range} onRangeChange={setRange} from={filters.from} to={filters.to} onFromChange={setFrom} onToChange={setTo} compare={filters.compare ?? "none"} onCompareChange={setCompare} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Buyurtmalar" value={d.ordersCount} />
        <StatTile label="Tushum" value={formatMoneyMinor(d.revenueMinor)} />
        <StatTile label="Kliklar" value={d.clicksCount} />
        <StatTile label="Konversiya" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        <StatTile label="Creatorlar soni" value={d.creatorCount} />
        <StatTile label="O'rtacha creator tushumi" value={formatMoneyMinor(d.averageCreatorRevenueMinor)} />
      </div>

      <RevenueTrendChart trend={d.trend} />

      <Card>
        <CardHeader>
          <CardTitle>Top creatorlar</CardTitle>
        </CardHeader>
        {d.topCreators.length === 0 ? (
          <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
        ) : (
          <ul className="space-y-2 font-body text-sm">
            {d.topCreators.map((c) => (
              <li key={c.creatorId} className="flex justify-between">
                <span className="text-text-primary">{c.displayName}</span>
                <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
