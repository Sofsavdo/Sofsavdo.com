"use client";

import { useParams } from "next/navigation";
import { formatMoneyMinor } from "@sofsavdo/types";
import { AnalyticsFilterBar, Card, CardHeader, CardTitle, Skeleton, StatTile } from "@sofsavdo/ui";
import { useAnalyticsFilters } from "@/lib/useAnalyticsFilters";
import { useCreatorAnalyticsDetail } from "@/services/admin/analytics";

export default function CreatorAnalyticsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, setRange, setFrom, setTo, setCompare } = useAnalyticsFilters();
  const query = useCreatorAnalyticsDetail(id, filters);

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
      <h1 className="font-heading text-2xl font-bold text-text-primary">{d.displayName}</h1>

      <AnalyticsFilterBar range={filters.range} onRangeChange={setRange} from={filters.from} to={filters.to} onFromChange={setFrom} onToChange={setTo} compare={filters.compare ?? "none"} onCompareChange={setCompare} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Buyurtmalar" value={d.ordersCount} />
        <StatTile label="Tushum" value={formatMoneyMinor(d.revenueMinor)} />
        <StatTile label="Kliklar" value={d.clicksCount} />
        <StatTile label="Konversiya" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        <StatTile label="Ko'rishlar" value="Mavjud emas" />
        <StatTile label="Ariza tasdiqlanish darajasi" value={`${(d.approvalRate * 100).toFixed(1)}%`} />
        <StatTile label="O'rtacha to'lov (payout)" value={formatMoneyMinor(d.averagePayoutMinor)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daromad holati bo&apos;yicha</CardTitle>
          </CardHeader>
          {Object.keys(d.earningsByStatus).length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {Object.entries(d.earningsByStatus).map(([status, amount]) => (
                <li key={status} className="flex justify-between">
                  <span className="text-text-secondary">{status}</span>
                  <span className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Referral statistikasi</CardTitle>
          </CardHeader>
          <ul className="space-y-2 font-body text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Taklif qilingan creatorlar</span>
              <span className="font-numeric tabular-nums text-text-primary">{d.referralStats.totalReferred}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Malakali (qualified)</span>
              <span className="font-numeric tabular-nums text-text-primary">{d.referralStats.qualified}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Jami mukofotlar</span>
              <span className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(d.referralStats.totalRewardsMinor)}</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top kampaniyalar</CardTitle>
          </CardHeader>
          {d.topCampaigns.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {d.topCampaigns.map((c) => (
                <li key={c.campaignId} className="flex justify-between">
                  <span className="text-text-primary">{c.name}</span>
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
          {d.topProducts.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2 font-body text-sm">
              {d.topProducts.map((p) => (
                <li key={p.productId} className="flex justify-between">
                  <span className="text-text-primary">{p.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(p.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
