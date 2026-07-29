"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { ArrowLeft } from "lucide-react";
import { useAdminReferral, useApproveReferralReward, useDisqualifyReferral, useRejectReferralReward } from "@/services/admin/referrals";
import { referralActivityMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

export default function CreatorReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useAdminReferral(id);
  const disqualify = useDisqualifyReferral();
  const approveReward = useApproveReferralReward();
  const rejectReward = useRejectReferralReward();
  const [disqualifyModal, setDisqualifyModal] = useState(false);
  const [rejectRewardId, setRejectRewardId] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const referral = query.data;
  if (!referral) {
    return (
      <Alert tone="error">
        Referral topilmadi.{" "}
        <Link href="/admin/creator-referrals" className="underline">
          Ro&apos;yxatga qaytish
        </Link>
      </Alert>
    );
  }

  const meta = referralActivityMeta[referral.activity];
  const actionError = (disqualify.error as ApiError | null) ?? (approveReward.error as ApiError | null) ?? (rejectReward.error as ApiError | null);

  return (
    <div className="space-y-6">
      <Link href="/admin/creator-referrals" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Barcha referrallar
      </Link>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{referral.referred.displayName}</h1>
          <p className="font-body text-sm text-text-secondary">
            Referrer: <Link href={`/admin/creators/${referral.referrer.id}`} className="text-accent hover:underline">{referral.referrer.displayName}</Link>
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError.message}</Alert> : null}

      {referral.disqualifiedAt ? (
        <Alert tone="error">Diskvalifikatsiya qilingan: {referral.disqualificationReason}</Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Faoliyat</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-2 gap-3 font-body text-sm">
              <div>
                <dt className="text-xs text-text-muted">Ro&apos;yxatdan o&apos;tgan</dt>
                <dd className="text-text-primary">{new Date(referral.registeredAt).toLocaleDateString("uz-UZ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Referral kodi</dt>
                <dd className="text-text-primary">{referral.referralCodeUsed}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Kampaniya arizalari</dt>
                <dd className="text-text-primary">{referral.campaignApplicationCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Tasdiqlangan arizalar</dt>
                <dd className="text-text-primary">{referral.approvedCampaignApplicationCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Oxirgi faoliyat</dt>
                <dd className="text-text-primary">{new Date(referral.lastMeaningfulActivityAt).toLocaleDateString("uz-UZ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Malakali bo&apos;lgan</dt>
                <dd className="text-text-primary">{referral.qualifiedAt ? new Date(referral.qualifiedAt).toLocaleDateString("uz-UZ") : "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mukofotlar</CardTitle>
            </CardHeader>
            {referral.rewards.length === 0 ? (
              <p className="font-body text-sm text-text-muted">Hozircha mukofot yo&apos;q.</p>
            ) : (
              <ul className="divide-y divide-border">
                {referral.rewards.map((rw) => (
                  <li key={rw.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-body text-sm text-text-primary">{rw.ruleName}</p>
                      <p className="font-numeric text-sm tabular-nums text-text-secondary">{formatMoneyMinor(rw.calculatedRewardMinor, rw.currency)}</p>
                      {rw.rejectionReason ? <p className="font-body text-xs text-error">{rw.rejectionReason}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={rw.status === "APPROVED" ? "success" : rw.status === "REJECTED" ? "error" : rw.status === "PAID" ? "success" : "info"}
                        label={rw.status}
                      />
                      {rw.status === "PENDING" ? (
                        <>
                          <Button size="sm" disabled={approveReward.isPending} onClick={() => approveReward.mutate(rw.id)}>
                            Tasdiqlash
                          </Button>
                          <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setRejectRewardId(rw.id)}>
                            Rad etish
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Harakatlar</CardTitle>
            </CardHeader>
            {referral.disqualifiedAt ? (
              <p className="font-body text-sm text-text-muted">Bu referral allaqachon diskvalifikatsiya qilingan.</p>
            ) : (
              <Button variant="outline" className="w-full border-error text-error" onClick={() => setDisqualifyModal(true)}>
                Diskvalifikatsiya qilish
              </Button>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={disqualifyModal}
        title="Referralni diskvalifikatsiya qilish"
        description="Sabab kiriting — bu qaror qaytarib bo'lmaydi va audit logga yoziladi."
        confirmLabel="Diskvalifikatsiya qilish"
        destructive
        requireReason
        isPending={disqualify.isPending}
        onClose={() => setDisqualifyModal(false)}
        onConfirm={(reason) => {
          if (!reason || reason.trim().length < 5) return;
          disqualify.mutate({ id: referral.id, reason: reason.trim() });
          setDisqualifyModal(false);
        }}
      />

      <ConfirmModal
        open={!!rejectRewardId}
        title="Mukofotni rad etish"
        description="Sabab kiriting."
        confirmLabel="Rad etish"
        destructive
        requireReason
        isPending={rejectReward.isPending}
        onClose={() => setRejectRewardId(null)}
        onConfirm={(reason) => {
          if (!rejectRewardId || !reason || reason.trim().length < 5) return;
          rejectReward.mutate({ id: rejectRewardId, reason: reason.trim() });
          setRejectRewardId(null);
        }}
      />
    </div>
  );
}
