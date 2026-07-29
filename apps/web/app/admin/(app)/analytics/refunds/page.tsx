"use client";

import { formatMoneyMinor } from "@sofsavdo/types";
import { AnalyticsFilterBar, Card, CardHeader, CardTitle, SelectField, Skeleton, StatTile } from "@sofsavdo/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useRefundAnalytics } from "@/services/admin/analytics";
import { CampaignFilterSelect, CreatorFilterSelect, ProductFilterSelect, RegionFilterInput } from "@/components/admin/AnalyticsEntityFilters";

const REFUND_STATUSES = ["REQUESTED", "APPROVED", "PROCESSED", "REJECTED"];

export default function RefundAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setFilter } = useAnalyticsFilters();
  const query = useRefundAnalytics(filters);

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
      <h1 className="font-heading text-2xl font-bold text-text-primary">Refund Analytics</h1>

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
            <SelectField label="Refund statusi" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value || undefined)}>
              <option value="">Barchasi</option>
              {REFUND_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <CreatorFilterSelect value={filters.creatorId} onChange={(v) => setFilter("creatorId", v)} />
            <CampaignFilterSelect value={filters.campaignId} onChange={(v) => setFilter("campaignId", v)} />
            <ProductFilterSelect value={filters.productId} onChange={(v) => setFilter("productId", v)} />
            <RegionFilterInput value={filters.region} onChange={(v) => setFilter("region", v)} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="So'rovlar" value={d.requestedCount} />
        <StatTile label="Refund darajasi" value={`${(d.refundRate * 100).toFixed(1)}%`} />
        <StatTile label="Tasdiqlanish darajasi" value={`${(d.approvalRate * 100).toFixed(1)}%`} />
        <StatTile label="O'rtacha refund miqdori" value={formatMoneyMinor(d.averageRefundAmountMinor)} />
        <StatTile label="Jami refund qilingan" value={formatMoneyMinor(d.totalRefundedMinor)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eng ko&apos;p uchraydigan sabablar</CardTitle>
        </CardHeader>
        {d.topReasons.length === 0 ? (
          <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
        ) : (
          <ul className="space-y-2 font-body text-sm">
            {d.topReasons.map((r) => (
              <li key={r.reason} className="flex justify-between">
                <span className="text-text-primary">{r.reason}</span>
                <span className="font-numeric tabular-nums text-text-secondary">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
