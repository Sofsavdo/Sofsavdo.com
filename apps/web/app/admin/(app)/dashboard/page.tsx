"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Card, CardHeader, CardTitle, Skeleton, StatTile } from "@rosti/ui";
import { useAdminDashboard } from "@/services/admin/dashboard";
import { AdminDashboardChart } from "@/components/admin/AdminDashboardChart";

export default function AdminDashboardPage() {
  const query = useAdminDashboard();

  if (query.isLoading || !query.data) {
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

  const d = query.data;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Bugungi tushum" value={formatMoneyMinor(d.todayRevenueMinor)} />
        <StatTile label="Oylik tushum" value={formatMoneyMinor(d.monthlyRevenueMinor)} />
        <StatTile label="Net revenue" value={formatMoneyMinor(d.netRevenueMinor)} />
        <StatTile label="To'langan buyurtmalar" value={d.paidOrders} />
        <StatTile label="Conversion" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        <StatTile label="O'rtacha buyurtma (AOV)" value={formatMoneyMinor(d.averageOrderValueMinor)} />
        <StatTile label="Refund darajasi" value={`${(d.refundRate * 100).toFixed(1)}%`} />
        <StatTile label="Faol kampaniyalar" value={d.activeCampaignsCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Creator orqali tushum</CardTitle>
          </CardHeader>
          <p className="font-numeric text-xl font-semibold tabular-nums text-text-primary">{formatMoneyMinor(d.creatorRevenueMinor)}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Direct tushum</CardTitle>
          </CardHeader>
          <p className="font-numeric text-xl font-semibold tabular-nums text-text-primary">{formatMoneyMinor(d.directRevenueMinor)}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Commission liability</CardTitle>
          </CardHeader>
          <p className="font-numeric text-xl font-semibold tabular-nums text-text-primary">{formatMoneyMinor(d.commissionLiabilityMinor)}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending payouts</CardTitle>
          </CardHeader>
          <p className="font-numeric text-xl font-semibold tabular-nums text-text-primary">{formatMoneyMinor(d.pendingPayoutsMinor)}</p>
        </Card>
      </div>

      <AdminDashboardChart series7d={d.series7d} series30d={d.series30d} series90d={d.series90d} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Click → Landing → Checkout → Order funnel</CardTitle>
          </CardHeader>
          <ul className="space-y-2 font-body text-sm">
            {[
              { label: "Click", value: d.funnel.clicks },
              { label: "Landing view", value: d.funnel.landingViews },
              { label: "Checkout start", value: d.funnel.checkoutStarts },
              { label: "Order", value: d.funnel.orders },
              { label: "Paid order", value: d.funnel.paidOrders },
            ].map((step) => (
              <li key={step.label} className="flex items-center justify-between rounded-input border border-border px-3 py-2">
                <span className="text-text-secondary">{step.label}</span>
                <span className="font-numeric font-semibold tabular-nums text-text-primary">{step.value.toLocaleString("uz-UZ")}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Muhim vazifalar</CardTitle>
          </CardHeader>
          {d.tasks.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hozircha ogohlantirish yo&apos;q.</p>
          ) : (
            <ul className="space-y-2">
              {d.tasks.map((task) => (
                <li key={task.text}>
                  <Link href={task.href} className="flex items-center justify-between rounded-input border border-warning/40 bg-warning/10 px-3 py-2 font-body text-sm text-text-primary hover:border-warning">
                    {task.text}
                    <span className="text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top offerlar</CardTitle>
          </CardHeader>
          {d.topOffers.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hali ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2">
              {d.topOffers.map((o) => (
                <li key={o.name} className="flex items-center justify-between font-body text-sm">
                  <span className="text-text-primary">{o.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(o.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top creatorlar</CardTitle>
          </CardHeader>
          {d.topCreators.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hali ma&apos;lumot yo&apos;q.</p>
          ) : (
            <ul className="space-y-2">
              {d.topCreators.map((c) => (
                <li key={c.name} className="flex items-center justify-between font-body text-sm">
                  <span className="text-text-primary">{c.name}</span>
                  <span className="font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.revenueMinor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
