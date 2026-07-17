"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import type { CampaignStatus } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, SelectField, Skeleton, StatusBadge } from "@rosti/ui";
import {
  useAdminCampaign,
  useApproveCampaignApplication,
  useCampaignApplications,
  useRejectCampaignApplication,
  useUpdateCampaign,
} from "@/services/admin/campaigns";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { campaignStatusMeta, campaignApplicationStatusMeta } from "@/lib/status";
import { formatCommission } from "@/lib/commission-display";
import { ApiError } from "@/lib/api/admin";

const CAMPAIGN_STATUSES: CampaignStatus[] = ["DRAFT", "OPEN", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useAdminCampaign(id);
  const updateCampaign = useUpdateCampaign();
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
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-text-primary">{campaign.name}</h1>
          <StatusBadge tone={campaignStatusMeta[campaign.status].tone} label={campaignStatusMeta[campaign.status].label} />
        </div>
        <SelectField
          label=""
          className="h-9 w-40"
          value={campaign.status}
          onChange={(e) => updateCampaign.mutate({ id: campaign.id, patch: { status: e.target.value as CampaignStatus } })}
        >
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {campaignStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
      </div>

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
        {(applicationsQuery.data ?? []).filter((a) => a.campaignId === campaign.id).length === 0 ? (
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
