"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import type { RealExecutiveMetrics } from "@sofsavdo/types";
import { AnalyticsFilterBar, Button, Card, CardHeader, CardTitle, Skeleton, StatTile, deltaFromPct } from "@sofsavdo/ui";
import { Download } from "lucide-react";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useExecutiveAnalytics, useCreatorAnalyticsList, useCampaignAnalyticsList, useProductAnalyticsList, usePaymentAnalytics, useExportAnalyticsCsv } from "@/services/admin/analytics";
import { RevenueTrendChart, OrderStatusBarChart, PaymentMixPieChart } from "@/components/admin/AnalyticsCharts";
import { CampaignFilterSelect, CreatorFilterSelect } from "@/components/admin/AnalyticsEntityFilters";
import { useAdminSession } from "@/services/adminSession";
import { hasRole } from "@/lib/adminRouting";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// The 14 requested Executive Dashboard KPIs (+ Net Revenue, an extra already-computed field the
// backend carries for free) — one array instead of 15 near-identical <StatTile> blocks.
const TILES: Array<{ key: keyof RealExecutiveMetrics; label: string; format: (v: number) => string }> = [
  { key: "revenueMinor", label: "Revenue", format: formatMoneyMinor },
  { key: "gmvMinor", label: "GMV", format: formatMoneyMinor },
  { key: "netRevenueMinor", label: "Net Revenue", format: formatMoneyMinor },
  { key: "ordersCount", label: "Buyurtmalar", format: (v) => String(v) },
  { key: "paidOrdersCount", label: "To'langan buyurtmalar", format: (v) => String(v) },
  { key: "pendingOrdersCount", label: "Kutilayotgan buyurtmalar", format: (v) => String(v) },
  { key: "refundsMinor", label: "Refundlar", format: formatMoneyMinor },
  { key: "refundRate", label: "Refund darajasi", format: pct },
  { key: "activeCreatorsCount", label: "Faol creatorlar", format: (v) => String(v) },
  { key: "activeCampaignsCount", label: "Faol kampaniyalar", format: (v) => String(v) },
  { key: "activeProductsCount", label: "Faol mahsulotlar", format: (v) => String(v) },
  { key: "creatorLinkConversionRate", label: "Creator link konversiyasi", format: pct },
  { key: "averageOrderValueMinor", label: "O'rtacha buyurtma (AOV)", format: formatMoneyMinor },
  { key: "newCustomers", label: "Yangi mijozlar", format: (v) => String(v) },
  { key: "returningCustomers", label: "Qaytgan mijozlar", format: (v) => String(v) },
];

export default function AdminAnalyticsPage() {
  const { filters, setRange, setFrom, setTo, setCompare, setFilter } = useAnalyticsFilters();
  const { user: admin } = useAdminSession();
  // analytics.export is ADMIN+ only (RBAC.md) — hiding the button for MANAGER is UI-only
  // convenience matching every other ADMIN+-only action elsewhere in the admin UI; the real
  // boundary is the backend's @RequirePermissions("analytics.read", "analytics.export") guard.
  const canExport = hasRole(admin?.role, "ADMIN");

  const executive = useExecutiveAnalytics(filters);
  const topCreators = useCreatorAnalyticsList({ ...filters, pageSize: 5 });
  const topCampaigns = useCampaignAnalyticsList({ ...filters, pageSize: 5 });
  const topProducts = useProductAnalyticsList({ ...filters, pageSize: 5 });
  const payments = usePaymentAnalytics(filters);
  const exportCsv = useExportAnalyticsCsv();

  if (executive.isLoading || !executive.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const d = executive.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Executive Dashboard</h1>
        {canExport ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const csv = await exportCsv.mutateAsync({ view: "executive", filters });
              downloadCsv(csv, `sofsavdo-analytics-executive-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            disabled={exportCsv.isPending}
          >
            <Download className="mr-1.5 size-4" /> {exportCsv.isPending ? "Tayyorlanmoqda..." : "CSV eksport"}
          </Button>
        ) : null}
      </div>

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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TILES.map((tile) => {
          const value = d.current[tile.key];
          if (value === undefined) return null;
          return <StatTile key={tile.key} label={tile.label} value={tile.format(value as number)} delta={deltaFromPct(d.deltaPct?.[tile.key])} />;
        })}
      </div>

      <RevenueTrendChart trend={d.trend} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <OrderStatusBarChart statusBreakdown={d.statusBreakdown} />
        {payments.data ? <PaymentMixPieChart byMethod={payments.data.byMethod} /> : <Skeleton className="h-64 w-full" />}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top creatorlar</CardTitle>
          </CardHeader>
          {!topCreators.data || topCreators.data.items.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {topCreators.data.items.map((c) => (
                <li key={c.creatorId} className="flex justify-between">
                  <Link href={`/admin/analytics/creators/${c.creatorId}`} className="text-text-primary hover:text-accent hover:underline">
                    {c.displayName}
                  </Link>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top kampaniyalar</CardTitle>
          </CardHeader>
          {!topCampaigns.data || topCampaigns.data.items.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {topCampaigns.data.items.map((c) => (
                <li key={c.campaignId} className="flex justify-between">
                  <Link href={`/admin/analytics/campaigns/${c.campaignId}`} className="text-text-primary hover:text-accent hover:underline">
                    {c.name}
                  </Link>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top mahsulotlar</CardTitle>
          </CardHeader>
          {!topProducts.data || topProducts.data.items.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {topProducts.data.items.map((p) => (
                <li key={p.productId} className="flex justify-between">
                  <Link href={`/admin/analytics/products/${p.productId}`} className="text-text-primary hover:text-accent hover:underline">
                    {p.name}
                  </Link>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(p.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 font-body text-sm">
        <Link href="/admin/analytics/creators" className="text-accent hover:underline">
          Creator analytics →
        </Link>
        <Link href="/admin/analytics/campaigns" className="text-accent hover:underline">
          Campaign analytics →
        </Link>
        <Link href="/admin/analytics/products" className="text-accent hover:underline">
          Product analytics →
        </Link>
        <Link href="/admin/analytics/payments" className="text-accent hover:underline">
          Payment analytics →
        </Link>
        <Link href="/admin/analytics/refunds" className="text-accent hover:underline">
          Refund analytics →
        </Link>
        <Link href="/admin/analytics/customers" className="text-accent hover:underline">
          Customer analytics →
        </Link>
      </div>
    </div>
  );
}
