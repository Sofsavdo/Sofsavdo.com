"use client";

import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Card, CardHeader, CardTitle, CopyButton, EmptyState, Skeleton, StatTile } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";
import { useMyReferralRewards, useMyReferrals, useReferralCode, useReferralSummary } from "@/services/referrals";
import { referralActivityMeta } from "@/lib/status";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

export default function CreatorReferralsPage() {
  const codeQuery = useReferralCode();
  const summaryQuery = useReferralSummary();
  const friendsQuery = useMyReferrals();
  const rewardsQuery = useMyReferralRewards();

  if (!USE_REAL_API) {
    return (
      <Alert tone="info">Do&apos;stlarni taklif qilish faqat real API rejimida ishlaydi.</Alert>
    );
  }

  if (codeQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const summary = summaryQuery.data;
  const friends = friendsQuery.data ?? [];
  const rewards = rewardsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Do&apos;stlarni taklif qilish</h1>
        <p className="font-body text-sm text-text-secondary">
          Do&apos;stingizni {BRAND.name}&apos;ga taklif qiling. Mukofot faqat do&apos;stingiz haqiqiy ish boshlaganda (kampaniyaga ariza,
          tasdiqlangan ariza va h.k.) beriladi — shunchaki ro&apos;yxatdan o&apos;tish uchun emas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sizning taklif havolangiz</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 rounded-input border border-border bg-bg px-3 py-2 font-numeric text-sm text-text-primary">
            {codeQuery.data?.invitationLink}
          </code>
          <CopyButton value={codeQuery.data?.invitationLink ?? ""} label="Havolani nusxalash" />
        </div>
        <p className="mt-2 font-body text-xs text-text-muted">
          Referral kodingiz: <strong>{codeQuery.data?.referralCode}</strong>
        </p>
      </Card>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Taklif qilinganlar" value={String(summary.totalInvited)} />
          <StatTile label="Faol do'stlar" value={String(summary.activeCount)} />
          <StatTile label="Daromad keltirmoqda" value={String(summary.earningCount)} />
          <StatTile label="Rag'batlantirish kerak" value={String(summary.needsEncouragementCount)} />
        </div>
      ) : null}

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Mukofotlar</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-3 gap-3 font-body text-sm">
            <div>
              <dt className="text-xs text-text-muted">Kutilmoqda</dt>
              <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(summary.pendingRewardMinor, summary.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Tasdiqlangan</dt>
              <dd className="font-numeric tabular-nums text-success">{formatMoneyMinor(summary.approvedRewardMinor, summary.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">To&apos;langan</dt>
              <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(summary.paidRewardMinor, summary.currency)}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Taklif qilingan do&apos;stlar</CardTitle>
        </CardHeader>
        {friends.length === 0 ? (
          <EmptyState
            title="Hozircha hech kimni taklif qilmadingiz"
            description="Yuqoridagi havolani do'stlaringiz bilan bo'lishing."
          />
        ) : (
          <ul className="divide-y divide-border">
            {friends.map((f) => {
              const meta = referralActivityMeta[f.activity];
              return (
                <li key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-body text-sm font-medium text-text-primary">{f.displayName}</p>
                    <p className="font-body text-xs text-text-muted">
                      {new Date(f.registeredAt).toLocaleDateString("uz-UZ")} sanasida qo&apos;shildi ·{" "}
                      {f.approvedCampaignApplicationCount}/{f.campaignApplicationCount} ariza tasdiqlangan
                    </p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {rewards.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Mukofotlar tarixi</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border">
            {rewards.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-body text-sm text-text-primary">{r.referredDisplayName}</p>
                  <p className="font-body text-xs text-text-muted">{r.ruleName}</p>
                </div>
                <div className="text-right">
                  <p className="font-numeric text-sm tabular-nums text-text-primary">{formatMoneyMinor(r.calculatedRewardMinor, r.currency)}</p>
                  <Badge tone={r.status === "APPROVED" || r.status === "PAID" ? "success" : r.status === "REJECTED" ? "error" : "info"}>
                    {r.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
