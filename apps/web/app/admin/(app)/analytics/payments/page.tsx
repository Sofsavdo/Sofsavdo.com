"use client";

import { formatMoneyMinor } from "@rosti/types";
import { AnalyticsFilterBar, Card, CardHeader, CardTitle, SelectField, Skeleton, StatTile } from "@rosti/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { usePaymentAnalytics } from "@/services/admin/analytics";
import { PaymentMixPieChart } from "@/components/admin/AnalyticsCharts";
import { CampaignFilterSelect, CreatorFilterSelect, ProductFilterSelect, RegionFilterInput } from "@/components/admin/AnalyticsEntityFilters";

const PAYMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];

export default function PaymentAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setFilter } = useAnalyticsFilters();
  const query = usePaymentAnalytics(filters);

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
      <h1 className="font-heading text-2xl font-bold text-text-primary">Payment Analytics</h1>

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
            <SelectField label="To'lov statusi" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value || undefined)}>
              <option value="">Barchasi</option>
              {PAYMENT_STATUSES.map((s) => (
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
        <StatTile label="Jami to'lovlar" value={d.totalCount} />
        <StatTile label="Muvaffaqiyat darajasi" value={`${(d.successRate * 100).toFixed(1)}%`} />
        <StatTile label="Kutilmoqda" value={d.pendingCount} />
        <StatTile label="Muvaffaqiyatsiz" value={d.failedCount} />
        <StatTile label="Refundlar" value={formatMoneyMinor(d.refundsMinor)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PaymentMixPieChart byMethod={d.byMethod} />
        <Card>
          <CardHeader>
            <CardTitle>To&apos;lov usullari bo&apos;yicha</CardTitle>
          </CardHeader>
          {d.byMethod.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {d.byMethod.map((m) => (
                <li key={m.provider} className="flex justify-between">
                  <span className="text-text-primary">{m.provider}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">
                    {m.count} · {formatMoneyMinor(m.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
