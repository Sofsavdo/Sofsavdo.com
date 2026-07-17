"use client";

import { use } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
import { ArrowLeft, CheckCircle2, FileText, Image as ImageIcon, Video } from "lucide-react";
import { useApplyToCampaign, useCampaign, useMyCampaigns } from "@/services/campaigns";
import { formatCommission, formatDeadline, platformLabel } from "@/lib/commission-display";
import { creatorCampaignStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api";

const ASSET_ICONS = { image: ImageIcon, video: Video, brief: FileText, caption_template: FileText } as const;

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const campaignQuery = useCampaign(id);
  const myCampaignsQuery = useMyCampaigns();
  const applyMutation = useApplyToCampaign();

  if (campaignQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const campaign = campaignQuery.data;
  if (!campaign) {
    return (
      <Alert tone="error">
        Kampaniya topilmadi.{" "}
        <Link href="/creator/campaigns" className="underline">
          Katalogga qaytish
        </Link>
      </Alert>
    );
  }

  const existing = (myCampaignsQuery.data ?? []).find((cc) => cc.campaignId === campaign.id);
  const remainingSlots = Math.max(campaign.creatorLimit - campaign.approvedCreatorCount, 0);

  return (
    <div className="space-y-6">
      <Link href="/creator/campaigns" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Katalogga qaytish
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-body text-sm text-text-muted">{campaign.category}</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{campaign.name}</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">{campaign.offer.name}</p>
        </div>
        <div className="text-right">
          <p className="font-numeric text-xl font-semibold text-accent">{formatCommission(campaign)}</p>
          <p className="font-body text-xs text-text-muted">{formatDeadline(campaign.applicationDeadline)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Kampaniya haqida</CardTitle>
            </CardHeader>
            <p className="font-body text-sm text-text-secondary">{campaign.description}</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-body text-xs text-text-muted">Maqsad</dt>
                <dd className="font-body text-sm text-text-primary">{campaign.goal}</dd>
              </div>
              <div>
                <dt className="font-body text-xs text-text-muted">Maqsadli auditoriya</dt>
                <dd className="font-body text-sm text-text-primary">{campaign.targetAudience}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kontent talablari</CardTitle>
            </CardHeader>
            <div className="space-y-3 font-body text-sm">
              <div>
                <p className="mb-1 text-text-muted">Formatlar</p>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.contentFormats.map((f) => (
                    <Badge key={f} tone="neutral">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-text-muted">Majburiy elementlar</p>
                <ul className="list-inside list-disc text-text-primary">
                  {campaign.requiredElements.map((el) => (
                    <li key={el}>{el}</li>
                  ))}
                </ul>
              </div>
              {campaign.forbiddenElements.length > 0 ? (
                <div>
                  <p className="mb-1 text-text-muted">Taqiqlangan da&apos;volar</p>
                  <ul className="list-inside list-disc text-error">
                    {campaign.forbiddenElements.map((el) => (
                      <li key={el}>{el}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="text-text-muted">CTA</p>
                <p className="font-medium text-text-primary">{campaign.ctaLabel}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materiallar</CardTitle>
            </CardHeader>
            <ul className="space-y-2">
              {campaign.assets.map((asset) => {
                const Icon = ASSET_ICONS[asset.kind];
                return (
                  <li key={asset.id} className="flex items-center gap-2 font-body text-sm text-text-primary">
                    <Icon className="size-4 text-text-muted" /> {asset.label}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shartlar</CardTitle>
            </CardHeader>
            <dl className="space-y-3 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Narx</dt>
                <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(campaign.offer.priceMinor)}</dd>
              </div>
              {campaign.customerDiscountValue ? (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Xaridorga chegirma</dt>
                  <dd className="text-text-primary">
                    {campaign.customerDiscountType === "PERCENTAGE"
                      ? `${(campaign.customerDiscountValue / 100).toFixed(0)}%`
                      : formatMoneyMinor(campaign.customerDiscountValue)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-text-muted">Barter</dt>
                <dd className="text-text-primary">{campaign.barterEnabled ? campaign.freeProduct ?? "Ha" : "Yo'q"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Platformalar</dt>
                <dd className="text-text-primary">{campaign.platforms.map(platformLabel).join(", ")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Qolgan joy</dt>
                <dd className="text-text-primary">{remainingSlots} / {campaign.creatorLimit}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Attribution muddati</dt>
                <dd className="text-text-primary">{campaign.attributionWindowDays} kun</dd>
              </div>
            </dl>
          </Card>

          <Card>
            {existing ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="size-6 text-success" />
                <p className="font-body text-sm text-text-primary">Siz bu kampaniyaga murojaat qilgansiz</p>
                <Badge tone={creatorCampaignStatusMeta[existing.status].tone}>
                  {creatorCampaignStatusMeta[existing.status].label}
                </Badge>
                <Link href="/creator/my-campaigns" className="font-body text-sm text-accent underline">
                  Mening kampaniyalarimda ko&apos;rish
                </Link>
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  disabled={remainingSlots === 0 || applyMutation.isPending}
                  onClick={() => applyMutation.mutate(campaign.id)}
                >
                  {applyMutation.isPending
                    ? "Yuborilmoqda..."
                    : remainingSlots === 0
                      ? "Joy qolmadi"
                      : campaign.requiresApproval
                        ? "Ariza yuborish"
                        : "Darhol qo'shilish"}
                </Button>
                {applyMutation.isError ? (
                  <Alert tone="error" className="mt-3">
                    {(applyMutation.error as ApiError).message}
                  </Alert>
                ) : null}
                {applyMutation.isSuccess ? (
                  <Alert tone="success" className="mt-3">
                    {campaign.requiresApproval
                      ? "Arizangiz yuborildi. Admin tasdiqlagach, referral havolangiz shu yerda paydo bo'ladi."
                      : "Kampaniyaga qo'shildingiz! Referral havolangiz tayyor."}
                  </Alert>
                ) : null}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
