"use client";

import { formatMoneyMinor } from "@sofsavdo/types";
import { AnalyticsFilterBar, Skeleton, StatTile } from "@sofsavdo/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useCustomerAnalytics } from "@/services/admin/analytics";
import { CampaignFilterSelect, CreatorFilterSelect, ProductFilterSelect, RegionFilterInput } from "@/components/admin/AnalyticsEntityFilters";

export default function CustomerAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setFilter } = useAnalyticsFilters();
  const query = useCustomerAnalytics(filters);

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
      <h1 className="font-heading text-2xl font-bold text-text-primary">Customer Analytics</h1>

      <AnalyticsFilterBar
        range={filters.range}
        onRangeChange={setRange}
        from={filters.from}
        to={filters.to}
        onFromChange={setFrom}
        onToChange={setTo}
        compare={filters.compare ?? "none"}
        onCompareChange={setCompare}
        extra={
          <>
            <CreatorFilterSelect value={filters.creatorId} onChange={(v) => setFilter("creatorId", v)} />
            <CampaignFilterSelect value={filters.campaignId} onChange={(v) => setFilter("campaignId", v)} />
            <ProductFilterSelect value={filters.productId} onChange={(v) => setFilter("productId", v)} />
            <RegionFilterInput value={filters.region} onChange={(v) => setFilter("region", v)} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Faol mijozlar" value={d.activeCustomersCount} />
        <StatTile label="Yangi mijozlar" value={d.newCustomersCount} />
        <StatTile label="Qaytgan mijozlar" value={d.returningCustomersCount} />
        <StatTile label="O'rtacha umr bo'yi qiymat (LTV)" value={formatMoneyMinor(d.averageLifetimeValueMinor)} />
        <StatTile label="O'rtacha buyurtma chastotasi" value={d.averageOrderFrequency.toFixed(1)} />
      </div>
    </div>
  );
}
