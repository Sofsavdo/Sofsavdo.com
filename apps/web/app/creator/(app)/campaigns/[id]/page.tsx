"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor, type Campaign, type CampaignApplicationCreatorView, type SocialPlatform } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, CopyButton, Skeleton } from "@sofsavdo/ui";
import { ArrowLeft, Award, CheckCircle2, FileText, Image as ImageIcon, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useApplyToCampaign,
  useCampaign,
  useMyApplications,
  useMyCampaigns,
  useResubmitApplication,
  useUpdateApplication,
  useWithdrawApplication,
} from "@/services/campaigns";
import { useCreateContentDraft } from "@/services/content";
import { formatCommission, formatDeadline, platformLabel } from "@/lib/commission-display";
import { campaignApplicationStatusMeta, creatorCampaignStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api";

const ASSET_ICONS = { image: ImageIcon, video: Video, brief: FileText, logo: Award, caption_template: FileText } as const;
const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

interface ApplicationFormState {
  message: string;
  platform: SocialPlatform | "";
  contentFormat: string;
  portfolioLinks: string;
}

function toInput(form: ApplicationFormState) {
  return {
    message: form.message || undefined,
    platform: form.platform || undefined,
    contentFormat: form.contentFormat || undefined,
    portfolioLinks: form.portfolioLinks
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function ApplicationFields({
  campaign,
  form,
  setForm,
}: {
  campaign: Campaign;
  form: ApplicationFormState;
  setForm: (f: ApplicationFormState) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="app-message" className="mb-1 block font-body text-xs text-text-muted">
          Nima uchun aynan siz? (pitch)
        </label>
        <textarea
          id="app-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full rounded-input border border-border bg-bg px-3 py-2 font-body text-sm"
          placeholder="Auditoriyangiz va kontent uslubingiz haqida qisqacha yozing"
        />
      </div>
      <div>
        <label htmlFor="app-platform" className="mb-1 block font-body text-xs text-text-muted">
          Platforma
        </label>
        <select
          id="app-platform"
          value={form.platform}
          onChange={(e) => setForm({ ...form, platform: e.target.value as SocialPlatform | "" })}
          className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="">Tanlang</option>
          {campaign.platforms.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="app-format" className="mb-1 block font-body text-xs text-text-muted">
          Kontent formati
        </label>
        <select
          id="app-format"
          value={form.contentFormat}
          onChange={(e) => setForm({ ...form, contentFormat: e.target.value })}
          className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="">Tanlang</option>
          {campaign.contentFormats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="app-links" className="mb-1 block font-body text-xs text-text-muted">
          Portfolio havolalari (har birini yangi qatordan)
        </label>
        <textarea
          id="app-links"
          value={form.portfolioLinks}
          onChange={(e) => setForm({ ...form, portfolioLinks: e.target.value })}
          rows={2}
          className="w-full rounded-input border border-border bg-bg px-3 py-2 font-body text-sm"
          placeholder="https://instagram.com/p/..."
        />
      </div>
    </div>
  );
}

// Status-aware panel for an existing application against this campaign (real backend only — the
// mock has no per-application records, so this never renders there). Handles the
// changes-requested edit+resubmit loop and withdrawal; APPROVED falls through to the membership
// card below instead.
function ApplicationPanel({ application, campaign }: { application: CampaignApplicationCreatorView; campaign: Campaign }) {
  const [form, setForm] = useState<ApplicationFormState>({
    message: application.message ?? "",
    platform: application.platform ?? "",
    contentFormat: application.contentFormat ?? "",
    portfolioLinks: application.portfolioLinks.join("\n"),
  });
  const updateMutation = useUpdateApplication();
  const resubmitMutation = useResubmitApplication();
  const withdrawMutation = useWithdrawApplication();
  const meta = campaignApplicationStatusMeta[application.status];
  const canWithdraw = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(application.status);
  const error =
    (updateMutation.error as ApiError | null) ?? (resubmitMutation.error as ApiError | null) ?? (withdrawMutation.error as ApiError | null);

  async function handleResubmit() {
    await updateMutation.mutateAsync({ id: application.id, input: toInput(form) });
    await resubmitMutation.mutateAsync(application.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-sm text-text-primary">Sizning arizangiz</p>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {application.status === "REJECTED" && application.rejectionReason ? (
        <Alert tone="error">Rad etish sababi: {application.rejectionReason}</Alert>
      ) : null}

      {application.status === "CHANGES_REQUESTED" ? (
        <>
          <Alert tone="warning">O&apos;zgartirish so&apos;raldi: {application.changesRequestedReason}</Alert>
          <ApplicationFields campaign={campaign} form={form} setForm={setForm} />
          <Button
            className="w-full"
            disabled={updateMutation.isPending || resubmitMutation.isPending}
            onClick={handleResubmit}
          >
            {updateMutation.isPending || resubmitMutation.isPending ? "Yuborilmoqda..." : "Qayta yuborish"}
          </Button>
        </>
      ) : null}

      {canWithdraw ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={withdrawMutation.isPending}
          onClick={() => withdrawMutation.mutate(application.id)}
        >
          {withdrawMutation.isPending ? "Bekor qilinmoqda..." : "Arizani bekor qilish"}
        </Button>
      ) : null}

      {error ? <Alert tone="error">{error.message}</Alert> : null}
    </div>
  );
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const campaignQuery = useCampaign(id);
  const myCampaignsQuery = useMyCampaigns();
  const applicationsQuery = useMyApplications();
  const applyMutation = useApplyToCampaign();
  const createContentMutation = useCreateContentDraft();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ApplicationFormState>({ message: "", platform: "", contentFormat: "", portfolioLinks: "" });

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
  // Real backend only — mock resolves []; WITHDRAWN applications don't block the merged card.
  const application = (applicationsQuery.data ?? []).find((a) => a.campaignId === campaign.id && a.status !== "WITHDRAWN");
  // creatorLimit === 0 means "no limit" in the real mapping (backend null → 0, see
  // creator-real.ts) — an unlimited campaign must never read as "full".
  const remainingSlots = campaign.creatorLimit > 0 ? Math.max(campaign.creatorLimit - campaign.approvedCreatorCount, 0) : Infinity;

  return (
    <div className="space-y-6">
      <Link href="/creator/campaigns" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Katalogga qaytish
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="font-body text-sm text-text-muted">{campaign.category}</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary break-words">{campaign.name}</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">{campaign.offer.name}</p>
        </div>
        <div className="shrink-0 text-right">
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

          {campaign.media && campaign.media.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Media</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {campaign.media
                  .filter((m) => m.mediaRole !== "COVER")
                  .map((m) => (
                    <div key={m.id} className="space-y-1">
                      {m.mediaType === "IMAGE" ? (
                        <img src={m.url} alt={m.altText ?? ""} className="aspect-[3/4] w-full rounded-input border border-border object-cover" />
                      ) : (
                        <video src={m.url} controls className="aspect-[3/4] w-full rounded-input border border-border object-cover" />
                      )}
                      <Badge tone={m.mediaRole === "PROMOTIONAL" ? "info" : "neutral"}>
                        {m.mediaRole === "PROMOTIONAL" ? "Promo material" : "Galereya"}
                      </Badge>
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}

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

          {campaign.assets && campaign.assets.length > 0 ? (
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
          ) : null}
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
                <dd className="text-text-primary">
                  {campaign.creatorLimit > 0 ? `${remainingSlots} / ${campaign.creatorLimit}` : "Cheklanmagan"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Attribution muddati</dt>
                <dd className="text-text-primary">{campaign.attributionWindowDays} kun</dd>
              </div>
            </dl>
          </Card>

          <Card>
            {application && application.status !== "APPROVED" ? (
              <ApplicationPanel application={application} campaign={campaign} />
            ) : existing ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="size-6 text-success" />
                <p className="font-body text-sm text-text-primary">Siz bu kampaniyaga murojaat qilgansiz</p>
                <Badge tone={creatorCampaignStatusMeta[existing.status].tone}>
                  {creatorCampaignStatusMeta[existing.status].label}
                </Badge>
                <Link href="/creator/my-campaigns" className="font-body text-sm text-accent underline">
                  Mening kampaniyalarimda ko&apos;rish
                </Link>

                {existing.status === "ACTIVE" && existing.referralLink ? (
                  <div className="mt-3 w-full space-y-1.5 rounded-input border border-border bg-bg p-3 text-left">
                    <p className="font-body text-xs font-medium text-text-muted">
                      Sizning referral havolangiz — shu havola bilan ulashing
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate rounded-input bg-surface px-2.5 py-1.5 font-body text-xs text-text-secondary">
                        {existing.referralLink.fullUrl}
                      </code>
                      <CopyButton value={existing.referralLink.fullUrl} label="" />
                    </div>
                  </div>
                ) : null}

              </div>
            ) : (
              <>
                {showForm ? <ApplicationFields campaign={campaign} form={form} setForm={setForm} /> : null}
                <Button
                  className={showForm ? "mt-3 w-full" : "w-full"}
                  disabled={remainingSlots === 0 || applyMutation.isPending}
                  onClick={() => {
                    // First click opens the form (real application data: pitch/platform/format/
                    // links); second click actually creates + submits the application.
                    if (!showForm && campaign.requiresApproval) {
                      setShowForm(true);
                      return;
                    }
                    applyMutation.mutate({ campaignId: campaign.id, input: toInput(form) });
                  }}
                >
                  {applyMutation.isPending
                    ? "Yuborilmoqda..."
                    : remainingSlots === 0
                      ? "Joy qolmadi"
                      : campaign.requiresApproval
                        ? showForm
                          ? "Arizani yuborish"
                          : "Ariza yuborish"
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
