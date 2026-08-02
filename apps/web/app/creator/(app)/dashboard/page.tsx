"use client";

import Link from "next/link";
import { formatMoneyMinor, type CreatorApplicationStatus } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, StatTile } from "@sofsavdo/ui";
import { useDashboardStats } from "@/services/dashboard";
import { useMyCampaigns, useCampaigns, useMyProducts, useAvailableProductsForPromotion, useSelectProductForPromotion } from "@/services/campaigns";
import { useSales, usePayoutsMine } from "@/services/finance";
import { useSession } from "@/services/session";
import { canWorkAsCreator } from "@/lib/routing";
import { applicationStatusMeta, creatorCampaignStatusMeta, realPayoutStatusMeta } from "@/lib/status";
import { DashboardChart } from "@/components/creator/DashboardChart";
import { SalesTable } from "@/components/creator/SalesTable";
import { ActivityTicker } from "@/components/creator/ActivityTicker";
import { LaunchBonusProgress } from "@/components/creator/LaunchBonusProgress";

// Shown instead of the real (earning-data-heavy) dashboard while a creator's application is
// SUBMITTED/UNDER_REVIEW — CreatorAppGuard already lets them reach /creator/dashboard at this
// status (see lib/routing.ts's canEnterCabinet), but every campaign/sales/content/payout query
// below is still approval-gated on the backend, so this pending view deliberately never fires
// them (see the `enabled: approved` wiring in the component below).
function PendingDashboard({ status }: { status: CreatorApplicationStatus }) {
  const meta = applicationStatusMeta[status];
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Xush kelibsiz!</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Arizangiz holati</CardTitle>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </CardHeader>
        <Alert tone="info">
          Arizangiz admin tomonidan ko&apos;rib chiqilmoqda. Tasdiqlangach, sizga bildirishnoma
          yuboriladi va quyidagi bo&apos;limlar avtomatik ochiladi: referal havola, kampaniyalar,
          kontent yuklash, sotuvlar va pul yechish. Hozircha profilingizni to&apos;ldirib,
          bildirishnomalarni kuzatib turishingiz mumkin.
        </Alert>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/creator/profile" className="rounded-input border border-border p-4 hover:border-accent">
          <p className="font-body text-sm font-medium text-text-primary">Profilni to&apos;ldirish</p>
          <p className="mt-1 font-body text-xs text-text-muted">Ijtimoiy tarmoqlar va ma&apos;lumotlaringizni tekshiring</p>
        </Link>
        <Link href="/creator/notifications" className="rounded-input border border-border p-4 hover:border-accent">
          <p className="font-body text-sm font-medium text-text-primary">Bildirishnomalar</p>
          <p className="mt-1 font-body text-xs text-text-muted">Tasdiqlanganda shu yerda xabar beramiz</p>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const approved = !!user && canWorkAsCreator(user.application.status);

  const stats = useDashboardStats();
  const myCampaigns = useMyCampaigns({ enabled: approved });
  const sales = useSales({ enabled: approved });
  const payouts = usePayoutsMine(1, { enabled: approved });
  const allCampaigns = useCampaigns({ enabled: approved });
  const availableProducts = useAvailableProductsForPromotion({ enabled: approved });
  const selectProduct = useSelectProductForPromotion();

  const isLoading = stats.isLoading || (approved && myCampaigns.isLoading);

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

  if (!approved) {
    return <PendingDashboard status={user!.application.status} />;
  }

  const d = stats.data;
  const activeCampaigns = (myCampaigns.data ?? []).filter((cc) => cc.status === "ACTIVE");
  const payoutItems = payouts.data?.items ?? [];
  const requiredActions = [
    ...payoutItems
      .filter((p) => p.status === "REQUESTED" || p.status === "PROCESSING")
      .map((p) => ({
        key: `payout_${p.id}`,
        text: `${formatMoneyMinor(p.amountMinor)} miqdoridagi payout so'rovingiz ko'rib chiqilmoqda`,
        href: "/creator/earnings",
      })),
  ];
  const latestPayout = payoutItems[0];
  const joinedCampaignIds = new Set((myCampaigns.data ?? []).map((cc) => cc.campaignId));
  const recommended = (allCampaigns.data ?? []).filter((c) => !joinedCampaignIds.has(c.id)).slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Dashboard</h1>

      <ActivityTicker />

      <LaunchBonusProgress />

      {/* Phase Q — a proactive nudge, not a surprise: the creator sees exactly why a payout
          request would be blocked (PayoutsService.requestPayout) before they even try, with a
          direct link to the one thing that resolves it. Premium-tier creators never see this,
          regardless of bio status — see DECISIONS.md ADR-034. */}
      {d.compliance.tier === "STANDARD" && d.compliance.bioComplianceStatus === "NON_COMPLIANT" ? (
        <Alert tone="warning">
          Bio&apos;ingizda sofsavdo.com havolasi topilmadi — bu talab bajarilmaguncha pul yechish imkonsiz.{" "}
          <Link href="/creator/profile" className="underline">
            Ijtimoiy tarmoq profilingizni tekshiring
          </Link>{" "}
          yoki Premium tarif imkoniyatlari haqida qo&apos;llab-quvvatlash xizmatiga murojaat qiling.
        </Alert>
      ) : null}

      {/* Hero balance card — the single highest-stakes number on this page (the creator's own
          money) previously sat as one equally-weighted tile among eight in a flat grid, with no
          visual distinction from "today's click count". Promoted to its own card with a direct
          withdraw CTA, matching DESIGN_SYSTEM.md's "no more than one solid-accent button visible
          at a time" rule (the dashboard's one primary action). */}
      <Card className="flex flex-col items-start justify-between gap-4 border-accent/20 bg-gradient-to-br from-surface to-bg sm:flex-row sm:items-center">
        <div>
          <p className="font-body text-sm text-text-secondary">Mavjud balans</p>
          <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary md:text-4xl">
            {formatMoneyMinor(d.wallet.availableMinor)}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/creator/earnings">Pul yechish</Link>
        </Button>
      </Card>

      <div>
        <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">Bugun</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Click" value={d.today.clicks} />
          <StatTile label="Sotuv" value={d.today.ordersCount} />
          <StatTile label="Savdo" value={formatMoneyMinor(d.today.salesMinor)} />
          <StatTile label="Conversion" value={`${(d.today.conversionRate * 100).toFixed(1)}%`} />
        </div>
      </div>

      <div>
        <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">Shu oy</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile label="Savdo" value={formatMoneyMinor(d.monthToDate.salesMinor)} />
          <StatTile label="Komissiya" value={formatMoneyMinor(d.monthToDate.commissionMinor)} />
          <StatTile label="Sotuvlar soni" value={d.monthToDate.ordersCount} />
        </div>
      </div>

      {/* Own referral funnel (Phase O) — the same honest 3-stage shape (Click → Order → Paid
          order) the admin dashboard shows platform-wide, scoped to this creator's own
          ReferralVisit/Attribution rows. No "landing view"/"checkout start" — this schema can't
          track either, see AdminDashboardService's own comment. */}
      <Card>
        <CardHeader>
          <CardTitle>Mening varonkam (shu oy)</CardTitle>
        </CardHeader>
        <ul className="space-y-2 font-body text-sm">
          {[
            { label: "Click", value: d.funnel.clicks },
            { label: "Buyurtma", value: d.funnel.orders },
            { label: "To'langan buyurtma", value: d.funnel.paidOrders },
          ].map((step) => (
            <li key={step.label} className="flex items-center justify-between rounded-input border border-border px-3 py-2">
              <span className="text-text-secondary">{step.label}</span>
              <span className="font-numeric font-semibold tabular-nums text-text-primary">{step.value.toLocaleString("uz-UZ")}</span>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 pt-1">
            <span className="text-text-muted">Konversiya</span>
            <span className="font-numeric font-semibold tabular-nums text-text-primary">{(d.funnel.conversionRate * 100).toFixed(1)}%</span>
          </li>
        </ul>
      </Card>

      {/* Lifetime — new (Phase J closes a real gap: the old dashboard never showed an all-time
          total at all). The single biggest "look how far you've come" number for a motivation
          system, so it gets its own visually distinct row rather than another flat grid tile. */}
      <div>
        <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">Umr bo&apos;yicha</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile label="Jami savdo" value={formatMoneyMinor(d.lifetime.salesMinor)} />
          <StatTile label="Jami komissiya" value={formatMoneyMinor(d.lifetime.commissionMinor)} />
          <StatTile label="Jami sotuvlar" value={d.lifetime.ordersCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kutilayotgan komissiya</CardTitle>
          </CardHeader>
          <p className="font-numeric text-2xl font-semibold tabular-nums text-text-primary">
            {formatMoneyMinor(d.wallet.pendingMinor)}
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
              <Badge tone={realPayoutStatusMeta[latestPayout.status].tone}>
                {realPayoutStatusMeta[latestPayout.status].label}
              </Badge>
            </div>
          ) : (
            <p className="font-body text-sm text-text-muted">Hali payout so&apos;rovi yo&apos;q</p>
          )}
        </Card>
      </div>

      <DashboardChart dailyRevenue30d={d.dailyRevenue30d} />

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

      <Card>
        <CardHeader>
          <CardTitle>Mahsulotlar uchun referral link olish</CardTitle>
        </CardHeader>
        {availableProducts.data?.length === 0 ? (
          <EmptyState
            title="Mahsulot yo'q"
            description="Hozircha targ'ib qilish uchun mahsulot yo'q."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {availableProducts.data?.map((product: any) => {
              const referralLink = product.offers?.[0]?.campaigns?.[0]?.referralLinks?.[0];
              return (
                <li key={product.id} className="flex flex-col gap-2 rounded-input border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-sm text-text-primary">{product.name}</span>
                    <Badge tone="neutral">{product.type}</Badge>
                  </div>
                  {referralLink ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?ref=${referralLink.code}`}
                        className="flex-1 rounded-input border border-border bg-bg px-2 py-1 font-body text-xs text-text-muted"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralLink.code}`)}
                      >
                        Nusxa olish
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectProduct.mutateAsync(product.id)}
                      disabled={selectProduct.isPending}
                    >
                      {selectProduct.isPending ? "Yaratilmoqda..." : "Referral link olish"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

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
