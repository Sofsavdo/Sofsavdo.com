"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton } from "@rosti/ui";
import { ArrowLeft } from "lucide-react";
import {
  useApproveApplication,
  useCampaignApplicationDetail,
  useRejectApplication,
  useRequestChangesApplication,
  useStartReviewApplication,
} from "@/services/admin/campaign-applications";
import { campaignApplicationStatusMeta } from "@/lib/status";
import { platformLabel } from "@/lib/commission-display";
import { ApiError } from "@/lib/api/admin";

function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleString("uz-UZ") : "—";
}

export default function CampaignApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useCampaignApplicationDetail(id);
  const startReview = useStartReviewApplication();
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const requestChanges = useRequestChangesApplication();
  const [modal, setModal] = useState<"reject" | "changes" | null>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const app = query.data;
  if (!app) {
    return (
      <Alert tone="error">
        Ariza topilmadi.{" "}
        <Link href="/admin/campaign-applications" className="underline">
          Ro&apos;yxatga qaytish
        </Link>
      </Alert>
    );
  }

  const meta = campaignApplicationStatusMeta[app.status];
  const actionError =
    (startReview.error as ApiError | null) ??
    (approve.error as ApiError | null) ??
    (reject.error as ApiError | null) ??
    (requestChanges.error as ApiError | null);
  const actionPending = startReview.isPending || approve.isPending || reject.isPending || requestChanges.isPending;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/campaign-applications"
        className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" /> Barcha arizalar
      </Link>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{app.creator.displayName}</h1>
          <p className="font-body text-sm text-text-secondary">
            <Link href={`/admin/campaigns/${app.campaignId}`} className="text-accent hover:underline">
              {app.campaign.name}
            </Link>{" "}
            · {app.campaign.category}
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError.message}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ariza mazmuni</CardTitle>
            </CardHeader>
            <dl className="space-y-3 font-body text-sm">
              <div>
                <dt className="text-xs text-text-muted">Pitch / xabar</dt>
                <dd className="whitespace-pre-wrap text-text-primary">{app.message || "—"}</dd>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-text-muted">Platforma</dt>
                  <dd className="text-text-primary">{app.platform ? platformLabel(app.platform) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Kontent formati</dt>
                  <dd className="text-text-primary">{app.contentFormat || "—"}</dd>
                </div>
                <div>
                  {/* Snapshot at application time — deliberately NOT the creator's live follower
                      count (see the schema's followerSnapshot column). */}
                  <dt className="text-xs text-text-muted">Obunachilar (ariza paytida)</dt>
                  <dd className="font-numeric tabular-nums text-text-primary">{app.followerSnapshot?.toLocaleString("uz-UZ") ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Shahar</dt>
                  <dd className="text-text-primary">{app.creator.city ?? "—"}</dd>
                </div>
              </div>
              {app.portfolioLinks.length > 0 ? (
                <div>
                  <dt className="text-xs text-text-muted">Portfolio</dt>
                  <dd>
                    <ul className="list-inside list-disc">
                      {app.portfolioLinks.map((l) => (
                        <li key={l}>
                          <a href={l} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">
                            {l}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
              {app.sampleContentLinks.length > 0 ? (
                <div>
                  <dt className="text-xs text-text-muted">Namuna kontent</dt>
                  <dd>
                    <ul className="list-inside list-disc">
                      {app.sampleContentLinks.map((l) => (
                        <li key={l}>
                          <a href={l} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">
                            {l}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
              {app.answers && Object.keys(app.answers).length > 0 ? (
                <div>
                  <dt className="text-xs text-text-muted">Kampaniya savollariga javoblar</dt>
                  <dd className="space-y-1">
                    {Object.entries(app.answers).map(([k, v]) => (
                      <p key={k} className="text-text-primary">
                        <span className="text-text-muted">{k}:</span> {String(v)}
                      </p>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {app.rejectionReason || app.changesRequestedReason ? (
            <Card>
              <CardHeader>
                <CardTitle>Ko&apos;rib chiqish tarixi</CardTitle>
              </CardHeader>
              <dl className="space-y-3 font-body text-sm">
                {app.changesRequestedReason ? (
                  <div>
                    <dt className="text-xs text-text-muted">O&apos;zgartirish so&apos;rovi sababi</dt>
                    <dd className="text-text-primary">{app.changesRequestedReason}</dd>
                  </div>
                ) : null}
                {app.rejectionReason ? (
                  <div>
                    <dt className="text-xs text-text-muted">Rad etish sababi</dt>
                    <dd className="text-error">{app.rejectionReason}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vaqt belgilari</CardTitle>
            </CardHeader>
            <dl className="space-y-2 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Yaratilgan</dt>
                <dd className="text-text-primary">{formatDate(app.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Yuborilgan</dt>
                <dd className="text-text-primary">{formatDate(app.submittedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Ko&apos;rib chiqilgan</dt>
                <dd className="text-text-primary">{formatDate(app.reviewedAt)}</dd>
              </div>
              {app.approvedAt ? (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Tasdiqlangan</dt>
                  <dd className="text-text-primary">{formatDate(app.approvedAt)}</dd>
                </div>
              ) : null}
              {app.rejectedAt ? (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Rad etilgan</dt>
                  <dd className="text-text-primary">{formatDate(app.rejectedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Harakatlar</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {app.status === "SUBMITTED" ? (
                <Button className="w-full" disabled={actionPending} onClick={() => startReview.mutate(app.id)}>
                  {startReview.isPending ? "Boshlanmoqda..." : "Ko'rib chiqishni boshlash"}
                </Button>
              ) : null}
              {app.status === "UNDER_REVIEW" ? (
                <>
                  <Button className="w-full" disabled={actionPending} onClick={() => approve.mutate(app.id)}>
                    {approve.isPending ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                  </Button>
                  <Button variant="outline" className="w-full" disabled={actionPending} onClick={() => setModal("changes")}>
                    O&apos;zgartirish so&apos;rash
                  </Button>
                  <Button variant="outline" className="w-full border-error text-error" disabled={actionPending} onClick={() => setModal("reject")}>
                    Rad etish
                  </Button>
                </>
              ) : null}
              {app.status === "APPROVED" ? (
                <Alert tone="info">
                  Ariza tasdiqlangan — creator kampaniyaga qo&apos;shildi. Kontent yuklash va moderatsiya oqimi keyingi bosqichda (Content
                  domain) qo&apos;shiladi.
                </Alert>
              ) : null}
              {["REJECTED", "WITHDRAWN"].includes(app.status) ? (
                <p className="font-body text-sm text-text-muted">
                  Bu ariza yakuniy holatda — boshqa harakat mavjud emas. Qayta ariza topshirish qo&apos;llab-quvvatlanmaydi (bitta creator +
                  bitta kampaniya = bitta ariza).
                </p>
              ) : null}
              {app.status === "CHANGES_REQUESTED" ? (
                <p className="font-body text-sm text-text-muted">Creator arizasini tahrirlab qayta yuborishi kutilmoqda.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={modal !== null}
        title={modal === "reject" ? "Arizani rad etish" : "O'zgartirish so'rash"}
        description={
          modal === "reject"
            ? "Rad etish sababini yozing — creator buni ko'radi. Rad etilgan ariza qayta tiklanmaydi."
            : "Nimani o'zgartirish kerakligini yozing — creator arizasini tahrirlab qayta yuboradi."
        }
        confirmLabel={modal === "reject" ? "Rad etish" : "So'rash"}
        destructive={modal === "reject"}
        requireReason
        isPending={reject.isPending || requestChanges.isPending}
        onClose={() => setModal(null)}
        onConfirm={(reason) => {
          const trimmed = (reason ?? "").trim();
          if (trimmed.length < 5) return;
          if (modal === "reject") reject.mutate({ id: app.id, reason: trimmed });
          else requestChanges.mutate({ id: app.id, reason: trimmed });
          setModal(null);
        }}
      />
    </div>
  );
}
