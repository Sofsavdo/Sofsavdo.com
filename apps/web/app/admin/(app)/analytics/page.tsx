"use client";

import { useState } from "react";
import { formatMoneyMinor } from "@rosti/types";
import { Button, Card, CardHeader, CardTitle, SelectField, Skeleton, StatTile } from "@rosti/ui";
import { Download } from "lucide-react";
import { useAdminAnalytics, useExportAnalyticsCsv } from "@/services/admin/analytics";
import { useAdminCampaigns } from "@/services/admin/campaigns";
import { useAdminOffers } from "@/services/admin/catalog";
import { useAdminCreators } from "@/services/admin/creators";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminAnalyticsPage() {
  const [campaignId, setCampaignId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [creatorId, setCreatorId] = useState("");

  const campaignsQuery = useAdminCampaigns();
  const offersQuery = useAdminOffers();
  const creatorsQuery = useAdminCreators();
  const analyticsQuery = useAdminAnalytics({ campaignId: campaignId || undefined, offerId: offerId || undefined, creatorId: creatorId || undefined });
  const exportCsv = useExportAnalyticsCsv();

  if (analyticsQuery.isLoading || !analyticsQuery.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const d = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const csv = await exportCsv.mutateAsync();
            downloadCsv(csv, `rosti-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
          }}
          disabled={exportCsv.isPending}
        >
          <Download className="mr-1.5 size-4" /> {exportCsv.isPending ? "Tayyorlanmoqda..." : "CSV eksport"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
        <SelectField label="Campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">Barchasi</option>
          {(campaignsQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Offer" value={offerId} onChange={(e) => setOfferId(e.target.value)}>
          <option value="">Barchasi</option>
          {(offersQuery.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Creator" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
          <option value="">Barchasi</option>
          {(creatorsQuery.data ?? [])
            .filter((c) => c.application.status === "APPROVED")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
        </SelectField>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Revenue" value={formatMoneyMinor(d.revenueMinor)} />
        <StatTile label="Net revenue" value={formatMoneyMinor(d.netRevenueMinor)} />
        <StatTile label="Buyurtmalar" value={d.ordersCount} />
        <StatTile label="To'langan" value={d.paidOrdersCount} />
        <StatTile label="Conversion" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        <StatTile label="AOV" value={formatMoneyMinor(d.averageOrderValueMinor)} />
        <StatTile label="Refund rate" value={`${(d.refundRate * 100).toFixed(1)}%`} />
        <StatTile label="EPC" value={formatMoneyMinor(1_240_00)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Click → Landing → Checkout → Order</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            ["Click", d.funnel.clicks],
            ["Landing", d.funnel.landingViews],
            ["Checkout", d.funnel.checkoutStarts],
            ["Order", d.funnel.orders],
            ["Paid", d.funnel.paidOrders],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-input border border-border bg-bg p-3">
              <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">{value}</p>
              <p className="font-body text-xs text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top creatorlar (ROI)</CardTitle>
          </CardHeader>
          {d.topCreators.length === 0 ? <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p> : (
            <ul className="space-y-2 font-body text-sm">
              {d.topCreators.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-text-primary">{c.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top campaignlar</CardTitle>
          </CardHeader>
          {d.topCampaigns.length === 0 ? <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p> : (
            <ul className="space-y-2 font-body text-sm">
              {d.topCampaigns.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-text-primary">{c.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top offerlar</CardTitle>
          </CardHeader>
          {d.topOffers.length === 0 ? <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p> : (
            <ul className="space-y-2 font-body text-sm">
              {d.topOffers.map((o) => (
                <li key={o.name} className="flex justify-between">
                  <span className="text-text-primary">{o.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(o.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
