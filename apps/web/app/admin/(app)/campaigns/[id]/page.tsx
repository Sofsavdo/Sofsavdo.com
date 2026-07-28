"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge } from "@rosti/ui";
import { Archive, CheckCircle2, Pause, Play } from "lucide-react";
import {
  useActivateCampaign,
  useAdminCampaign,
  useApproveCampaignApplication,
  useArchiveCampaign,
  useCampaignApplications,
  useCompleteCampaign,
  usePauseCampaign,
  useRejectCampaignApplication,
} from "@/services/admin/campaigns";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { CampaignMediaManager } from "@/components/admin/CampaignMediaManager";
import { campaignStatusMeta, campaignAvailabilityMeta, campaignApplicationStatusMeta } from "@/lib/status";
import { formatCommission } from "@/lib/commission-display";
import { ApiError } from "@/lib/api/admin";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

// Mirrors CampaignsService's ALLOWED_TRANSITIONS on the backend exactly — UX convenience only,
// the server re-checks every transition regardless.
const ALLOWED_NEXT_ACTIONS: Record<string, Array<"activate" | "pause" | "complete" | "archive">> = {
  DRAFT: ["activate", "archive"],
  ACTIVE: ["pause", "complete"],
  PAUSED: ["activate", "complete", "archive"],
  COMPLETED: ["archive"],
  ARCHIVED: [],
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useAdminCampaign(id);
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const completeCampaign = useCompleteCampaign();
  const archiveCampaignMut = useArchiveCampaign();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const applicationsQuery = useCampaignApplications();
  const approveApp = useApproveCampaignApplication();
  const rejectApp = useRejectCampaignApplication();
  const [rejectModal, setRejectModal] = useState<{ userId: string; ccId: string } | null>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const campaign = query.data;
  if (!campaign) return <Alert tone="error">Kampaniya topilmadi.</Alert>;

  const nextActions = ALLOWED_NEXT_ACTIONS[campaign.status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/offers" className="hover:text-text-primary">
          Offers
        </Link>
        <span>/</span>
        <Link href={`/admin/offers/${campaign.offer.id}`} className="hover:text-text-primary">
          {campaign.offer.name}
        </Link>
        <span>/</span>
        <span className="text-text-primary">{campaign.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words font-heading text-2xl font-bold text-text-primary">{campaign.name}</h1>
          <span className="shrink-0"><StatusBadge tone={campaignStatusMeta[campaign.status].tone} label={campaignStatusMeta[campaign.status].label} /></span>
          {campaign.availability ? (
            <span className="shrink-0"><StatusBadge tone={campaignAvailabilityMeta[campaign.availability].tone} label={campaignAvailabilityMeta[campaign.availability].label} /></span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {nextActions.includes("activate") ? (
            <Button variant="outline" size="sm" disabled={activateCampaign.isPending} onClick={() => activateCampaign.mutate(campaign.id)}>
              <Play className="mr-1.5 size-4" /> Faollashtirish
            </Button>
          ) : null}
          {nextActions.includes("pause") ? (
            <Button variant="outline" size="sm" disabled={pauseCampaign.isPending} onClick={() => pauseCampaign.mutate(campaign.id)}>
              <Pause className="mr-1.5 size-4" /> To&apos;xtatish
            </Button>
          ) : null}
          {nextActions.includes("complete") ? (
            <Button variant="outline" size="sm" disabled={completeCampaign.isPending} onClick={() => completeCampaign.mutate(campaign.id)}>
              <CheckCircle2 className="mr-1.5 size-4" /> Yakunlash
            </Button>
          ) : null}
          {nextActions.includes("archive") ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
              <Archive className="mr-1.5 size-4" /> Arxivlash
            </Button>
          ) : null}
        </div>
      </div>

      {campaign.landingAvailability && campaign.landingAvailability !== "PUBLISHED" ? (
        <Alert tone="warning">
          Bog&apos;langan Landing sahifa {campaign.landingAvailability === "MISSING" ? "mavjud emas" : "e'lon qilinmagan"} — kampaniyani
          faollashtirishdan oldin uni e&apos;lon qiling.
        </Alert>
      ) : null}

      <ConfirmModal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveCampaignMut.mutateAsync(campaign.id);
          setConfirmArchive(false);
        }}
        title="Kampaniyani arxivlash"
        description="Arxivlangan kampaniya qayta faollashtirilmaydi. Davom etishga ishonchingiz komilmi?"
        confirmLabel="Arxivlash"
        destructive
        isPending={archiveCampaignMut.isPending}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Komissiya</CardTitle>
          </CardHeader>
          <p className="font-body text-sm text-text-primary">{formatCommission(campaign)}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Creatorlar</CardTitle>
          </CardHeader>
          <p className="font-numeric text-lg tabular-nums text-text-primary">
            {campaign.approvedCreatorCount}/{campaign.creatorLimit}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Offer narxi</CardTitle>
          </CardHeader>
          <p className="font-numeric text-lg tabular-nums text-text-primary">{formatMoneyMinor(campaign.offer.priceMinor, campaign.offer.currency)}</p>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attribution</CardTitle>
          </CardHeader>
          <p className="font-numeric text-lg tabular-nums text-text-primary">{campaign.attributionWindowDays} kun</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kampaniya preview (creator ko&apos;radigan ma&apos;lumot)</CardTitle>
        </CardHeader>
        <div className="space-y-2 font-body text-sm">
          <p className="text-text-secondary">{campaign.description}</p>
          <p>
            <span className="text-text-muted">Maqsad:</span> {campaign.goal}
          </p>
          <p>
            <span className="text-text-muted">Auditoriya:</span> {campaign.targetAudience}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {campaign.platforms.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ushbu kampaniya bo&apos;yicha creator arizalari</CardTitle>
        </CardHeader>
        {USE_REAL_API ? (
          <Alert tone="info">
            Arizalar alohida ko&apos;rib chiqish sahifasida boshqariladi.{" "}
            <Link href={`/admin/campaign-applications?campaignId=${campaign.id}`} className="underline">
              Ushbu kampaniya arizalarini ochish
            </Link>
          </Alert>
        ) : (applicationsQuery.data ?? []).filter((a) => a.campaignId === campaign.id).length === 0 ? (
          <p className="font-body text-sm text-text-muted">Hozircha ariza yo&apos;q.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(applicationsQuery.data ?? [])
              .filter((a) => a.campaignId === campaign.id)
              .map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-body text-sm text-text-primary">{a.creatorName}</p>
                    {a.rejectionReason ? <p className="font-body text-xs text-error">{a.rejectionReason}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={campaignApplicationStatusMeta[a.status].tone} label={campaignApplicationStatusMeta[a.status].label} />
                    {a.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveApp.mutate({ userId: a.creatorId, ccId: a.id })}
                          disabled={approveApp.isPending || campaign.approvedCreatorCount >= campaign.creatorLimit}
                        >
                          Tasdiqlash
                        </Button>
                        <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setRejectModal({ userId: a.creatorId, ccId: a.id })}>
                          Rad etish
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        )}
        {campaign.approvedCreatorCount >= campaign.creatorLimit ? (
          <Alert tone="warning" className="mt-3">
            Creator limiti to&apos;lgan ({campaign.approvedCreatorCount}/{campaign.creatorLimit}) — yangi arizalarni tasdiqlashdan oldin limitni oshiring.
          </Alert>
        ) : null}
      </Card>

      {USE_REAL_API ? <CampaignMediaManager campaignId={campaign.id} /> : null}

      <div className="mx-auto max-w-2xl">
        <CampaignForm existing={campaign} />
      </div>

      <ConfirmModal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Arizani rad etish"
        requireReason
        destructive
        isPending={rejectApp.isPending}
        error={rejectApp.isError ? (rejectApp.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!rejectModal || !reason) return;
          await rejectApp.mutateAsync({ userId: rejectModal.userId, ccId: rejectModal.ccId, reason });
          setRejectModal(null);
        }}
      />
    </div>
  );
}
