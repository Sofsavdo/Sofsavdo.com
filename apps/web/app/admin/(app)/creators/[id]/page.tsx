"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatTile, StatusBadge } from "@rosti/ui";
import { ArrowLeft } from "lucide-react";
import {
  useRealCreatorDetail,
  useRealCreatorCampaignHistory,
  useRealCreatorEarningsSummary,
  useRealCreatorPayoutSummary,
  useRealCreatorReferralSummary,
  useSuspendRealCreator,
  useUnsuspendRealCreator,
  useBlockRealCreator,
  useUnblockRealCreator,
} from "@/services/admin/creators";
import { applicationStatusMeta, creatorAccountStatusMeta, creatorCampaignStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

function CreatorDetailContent({ id }: { id: string }) {
  const creatorQuery = useRealCreatorDetail(id);
  const historyQuery = useRealCreatorCampaignHistory(id);
  const earningsQuery = useRealCreatorEarningsSummary(id);
  const payoutQuery = useRealCreatorPayoutSummary(id);
  const referralQuery = useRealCreatorReferralSummary(id);
  const suspend = useSuspendRealCreator();
  const unsuspend = useUnsuspendRealCreator();
  const block = useBlockRealCreator();
  const unblock = useUnblockRealCreator();
  const [modal, setModal] = useState<"suspend" | "block" | null>(null);

  if (creatorQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const creator = creatorQuery.data;
  if (!creator) return <Alert tone="error">Creator topilmadi.</Alert>;

  const accountMeta = creatorAccountStatusMeta[creator.accountStatus === "DELETED" ? "BLOCKED" : creator.accountStatus];
  const actionError = suspend.isError
    ? (suspend.error as ApiError).message
    : unsuspend.isError
      ? (unsuspend.error as ApiError).message
      : block.isError
        ? (block.error as ApiError).message
        : unblock.isError
          ? (unblock.error as ApiError).message
          : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/creators" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">{creator.displayName}</h1>
          <p className="font-body text-sm text-text-muted">
            {creator.email} · {creator.city ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {creator.verified ? <Badge tone="success">Tasdiqlangan</Badge> : null}
          <StatusBadge tone={applicationStatusMeta[creator.onboardingStatus].tone} label={applicationStatusMeta[creator.onboardingStatus].label} />
          <StatusBadge tone={accountMeta.tone} label={accountMeta.label} />
        </div>
      </div>

      {creator.onboardingStatus === "SUBMITTED" || creator.onboardingStatus === "UNDER_REVIEW" ? (
        <Alert tone="info">
          Onboarding arizasi ko&apos;rib chiqilishi kerak.{" "}
          <Link href={`/admin/creator-applications/${creator.id}`} className="underline">
            Arizani ko&apos;rish
          </Link>
        </Alert>
      ) : null}

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Kutilayotgan" value={formatMoneyMinor(earningsQuery.data?.pendingMinor ?? 0)} />
        <StatTile label="To'lovga tayyor" value={formatMoneyMinor(earningsQuery.data?.payableMinor ?? 0)} />
        <StatTile label="To'langan" value={formatMoneyMinor(earningsQuery.data?.paidMinor ?? 0)} />
        <StatTile label="Payout so'ralgan" value={formatMoneyMinor(payoutQuery.data?.requestedMinor ?? 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral dasturi</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Taklif qilingan" value={referralQuery.data?.totalInvited ?? 0} />
          <StatTile label="Faol" value={referralQuery.data?.activeCount ?? 0} />
          <StatTile label="Daromad keltirmoqda" value={referralQuery.data?.earningCount ?? 0} />
          <StatTile label="Mukofot (kutilmoqda)" value={formatMoneyMinor(referralQuery.data?.pendingRewardMinor ?? 0)} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kampaniya tarixi</CardTitle>
        </CardHeader>
        {(historyQuery.data ?? []).length === 0 ? (
          <p className="font-body text-sm text-text-muted">Hali kampaniyaga qo&apos;shilmagan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(historyQuery.data ?? []).map((cc) => (
              <li key={cc.id} className="flex items-center justify-between py-2.5 font-body text-sm">
                <span className="text-text-primary">{cc.campaignName}</span>
                <Badge tone={cc.status in creatorCampaignStatusMeta ? creatorCampaignStatusMeta[cc.status as keyof typeof creatorCampaignStatusMeta].tone : "neutral"}>{cc.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creator.accountStatus !== "BLOCKED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Hisobni boshqarish</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {creator.accountStatus !== "SUSPENDED" ? (
              <Button variant="outline" size="sm" onClick={() => setModal("suspend")}>
                Vaqtincha to&apos;xtatish
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => unsuspend.mutate(id)} disabled={unsuspend.isPending}>
                Faollashtirish
              </Button>
            )}
            <Button variant="outline" size="sm" className="border-error text-error" onClick={() => setModal("block")}>
              Bloklash
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Hisobni boshqarish</CardTitle>
          </CardHeader>
          <Button variant="outline" size="sm" onClick={() => unblock.mutate(id)} disabled={unblock.isPending}>
            Blokdan chiqarish
          </Button>
        </Card>
      )}

      <ConfirmModal
        open={modal === "suspend" || modal === "block"}
        onClose={() => setModal(null)}
        title={modal === "block" ? "Creatorni bloklash" : "Vaqtincha to'xtatish"}
        description={modal === "block" ? "Bloklangan creator tizimga kira olmaydi." : "Creator vaqtincha kira olmaydi, kerak bo'lsa qayta faollashtirish mumkin."}
        requireReason
        destructive
        isPending={suspend.isPending || block.isPending}
        onConfirm={async (reason) => {
          if (!reason) return;
          if (modal === "block") await block.mutateAsync({ id, reason });
          else await suspend.mutateAsync({ id, reason });
          setModal(null);
        }}
      />
    </div>
  );
}

export default function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CreatorDetailContent id={id} />;
}
