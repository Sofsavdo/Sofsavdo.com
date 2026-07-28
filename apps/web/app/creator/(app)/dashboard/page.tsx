"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, StatTile } from "@rosti/ui";
import { useDashboardStats } from "@/services/dashboard";
import { useMyCampaigns, useCampaigns } from "@/services/campaigns";
import { useSales, usePayouts } from "@/services/finance";
import { useContent } from "@/services/content";
import { creatorCampaignStatusMeta, payoutStatusMeta } from "@/lib/status";
import { DashboardChart } from "@/components/creator/DashboardChart";
import { SalesTable } from "@/components/creator/SalesTable";

export default function DashboardPage() {
  const stats = useDashboardStats();
  const myCampaigns = useMyCampaigns();
  const sales = useSales();
  const content = useContent();
  const payouts = usePayouts();
  const allCampaigns = useCampaigns();

  const isLoading = stats.isLoading || myCampaigns.isLoading;

  if (isLoading || !stats.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const d = stats.data;
  const activeCampaigns = (myCampaigns.data ?? []).filter((cc) => cc.status === "ACTIVE");
  const requiredActions = [
    ...(content.data ?? [])
      .filter((c) => c.status === "DRAFT" || c.status === "REVISION_REQUESTED")
      .map((c) => ({
        key: `content_${c.id}`,
        text:
          c.status === "REVISION_REQUESTED"
            ? `"${c.campaignName}" uchun kontentga tuzatish talab qilingan`
            : `"${c.campaignName}" uchun kontent yuklashingiz kerak`,
        href: "/creator/content",
      })),
    ...(myCampaigns.data ?? [])
      .filter((cc) => cc.status === "CONTENT_REQUIRED")
      .map((cc) => ({
        key: `cc_${cc.id}`,
        text: `"${cc.campaign.name}" kampaniyasi uchun kontent talab qilinadi`,
        href: "/creator/content",
      })),
    ...(payouts.data ?? [])
      .filter((p) => p.status === "UNDER_REVIEW")
      .map((p) => ({
        key: `payout_${p.id}`,
        text: `${formatMoneyMinor(p.amountMinor)} miqdoridagi payout so'rovingiz ko'rib chiqilmoqda`,
        href: "/creator/payouts",
      })),
  ];
  const latestPayout = (payouts.data ?? [])[0];
  const joinedCampaignIds = new Set((myCampaigns.data ?? []).map((cc) => cc.campaignId));
  const recommended = (allCampaigns.data ?? []).filter((c) => !joinedCampaignIds.has(c.id)).slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>

      {/* Hero balance card — the single highest-stakes number on this page (the creator's own
          money) previously sat as one equally-weighted tile among eight in a flat grid, with no
          visual distinction from "today's click count". Promoted to its own card with a direct
          withdraw CTA, matching DESIGN_SYSTEM.md's "no more than one solid-accent button visible
          at a time" rule (the dashboard's one primary action). */}
      <Card className="flex flex-col items-start justify-between gap-4 border-accent/20 bg-gradient-to-br from-surface to-bg sm:flex-row sm:items-center">
        <div>
          <p className="font-body text-sm text-text-secondary">Mavjud balans</p>
          <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary md:text-4xl">
            {formatMoneyMinor(d.availableBalanceMinor)}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/creator/payouts">Pul yechish</Link>
        </Button>
      </Card>

      <div>
        <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">Bugun</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Click" value={d.today.clicks} />
          <StatTile label="Sotuv" value={d.today.orders} />
          <StatTile label="Daromad" value={formatMoneyMinor(d.today.revenueMinor)} />
          <StatTile label="Conversion" value={`${(d.conversionRate * 100).toFixed(1)}%`} />
        </div>
      </div>

      <div>
        <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">Shu oy</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile label="Savdo" value={formatMoneyMinor(d.monthToDate.salesMinor)} />
          <StatTile label="Komissiya" value={formatMoneyMinor(d.monthToDate.commissionMinor)} />
          <StatTile label="EPC (click boshiga)" value={formatMoneyMinor(d.epcMinor)} className="col-span-2 md:col-span-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kutilayotgan komissiya</CardTitle>
          </CardHeader>
          <p className="font-numeric text-2xl font-semibold tabular-nums text-text-primary">
            {formatMoneyMinor(d.pendingCommissionMinor)}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasdiqlangan komissiya</CardTitle>
          </CardHeader>
          <p className="font-numeric text-2xl font-semibold tabular-nums text-text-primary">
            {formatMoneyMinor(d.approvedCommissionMinor)}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payout holati</CardTitle>
          </CardHeader>
          {latestPayout ? (
            <div className="flex items-center justify-between gap-2">
              <span className="break-words font-numeric text-lg font-semibold tabular-nums">
                {formatMoneyMinor(latestPayout.amountMinor)}
              </span>
              <Badge tone={payoutStatusMeta[latestPayout.status].tone}>
                {payoutStatusMeta[latestPayout.status].label}
              </Badge>
            </div>
          ) : (
            <p className="font-body text-sm text-text-muted">Hali payout so&apos;rovi yo&apos;q</p>
          )}
        </Card>
      </div>

      <DashboardChart series7d={d.series7d} series30d={d.series30d} series90d={d.series90d} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bajarilishi kerak bo&apos;lgan vazifalar</CardTitle>
          </CardHeader>
          {requiredActions.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hozircha bajarilishi kerak bo&apos;lgan vazifa yo&apos;q.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requiredActions.map((action) => (
                <li key={action.key}>
                  <Link
                    href={action.href}
                    className="flex items-center justify-between rounded-input border border-border px-3 py-2 font-body text-sm text-text-primary hover:border-accent"
                  >
                    {action.text}
                    <span className="text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faol kampaniyalar</CardTitle>
          </CardHeader>
          {activeCampaigns.length === 0 ? (
            <EmptyState
              title="Faol kampaniya yo'q"
              description="Katalogdan kampaniya tanlab, hamkorlikni boshlang."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/creator/campaigns">Kampaniyalarni ko&apos;rish</Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {activeCampaigns.map((cc) => (
                <li key={cc.id} className="flex items-center justify-between rounded-input border border-border px-3 py-2">
                  <span className="font-body text-sm text-text-primary">{cc.campaign.name}</span>
                  <Badge tone={creatorCampaignStatusMeta[cc.status].tone}>
                    {creatorCampaignStatusMeta[cc.status].label}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>So&apos;nggi sotuvlar</CardTitle>
          <Link href="/creator/sales" className="font-body text-sm text-accent underline">
            Barchasini ko&apos;rish
          </Link>
        </CardHeader>
        <SalesTable sales={sales.data ?? []} limit={5} />
      </Card>

      {recommended.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tavsiya etilgan kampaniyalar</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {recommended.map((c) => (
              <Link
                key={c.id}
                href={`/creator/campaigns/${c.id}`}
                className="rounded-input border border-border p-3 hover:border-accent"
              >
                <p className="font-body text-sm font-medium text-text-primary">{c.name}</p>
                <p className="mt-1 font-body text-xs text-text-muted">{c.category}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
