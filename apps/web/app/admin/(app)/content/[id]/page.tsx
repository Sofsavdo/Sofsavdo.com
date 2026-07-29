"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton } from "@sofsavdo/ui";
import { ArrowLeft } from "lucide-react";
import {
  useContentReviewDetail,
  useStartReviewContent,
  useApproveContentReview,
  useRejectContentReview,
  useRequestChangesContent,
} from "@/services/admin/content";
import { realContentStatusMeta, contentReviewActionMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

export default function AdminContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useContentReviewDetail(id);
  const startReview = useStartReviewContent();
  const approve = useApproveContentReview();
  const reject = useRejectContentReview();
  const requestChanges = useRequestChangesContent();
  const [modal, setModal] = useState<"reject" | "request-changes" | null>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <Alert tone="error">
        Content topilmadi.{" "}
        <Link href="/admin/content" className="underline">
          Ro&apos;yxatga qaytish
        </Link>
      </Alert>
    );
  }

  const content = query.data;
  const actionError = startReview.isError
    ? (startReview.error as ApiError).message
    : approve.isError
      ? (approve.error as ApiError).message
      : reject.isError
        ? (reject.error as ApiError).message
        : requestChanges.isError
          ? (requestChanges.error as ApiError).message
          : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/content" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body text-sm text-text-muted">
            {content.creator.displayName} · {content.campaign.name}
          </p>
          <h1 className="font-heading text-xl font-bold text-text-primary">Content ko&apos;rib chiqish</h1>
        </div>
        <Badge tone={realContentStatusMeta[content.status].tone}>{realContentStatusMeta[content.status].label}</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Yuborilgan content</CardTitle>
            </CardHeader>
            <div className="space-y-3 font-body text-sm text-text-secondary">
              <p>{content.caption || "Caption kiritilmagan"}</p>
              {content.notes ? <p className="text-text-muted">Izoh: {content.notes}</p> : null}
              {content.hashtags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {content.hashtags.map((h) => (
                    <Badge key={h} tone="neutral">
                      {h}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {/* Phase P — the live link an admin clicks through to confirm the post actually
                  exists, alongside the screenshot attachment as the permanent evidence archive
                  independent of the link's future fate — see DECISIONS.md ADR-033. */}
              {content.postUrl ? (
                <p>
                  Post havolasi:{" "}
                  <a href={content.postUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                    {content.postUrl}
                  </a>
                </p>
              ) : (
                <p className="text-warning">Post havolasi kiritilmagan.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fayllar</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {content.attachments.map((a) => (
                <div key={a.id} className="space-y-1">
                  {a.attachmentType === "IMAGE" ? (
                    <img src={a.url} alt="" className="aspect-square w-full rounded-input border border-border object-cover" />
                  ) : (
                    <video src={a.url} controls className="aspect-square w-full rounded-input border border-border object-cover" />
                  )}
                  <Badge tone={a.role === "THUMBNAIL" ? "accent" : "neutral"}>{a.role === "THUMBNAIL" ? "Thumbnail" : "Fayl"}</Badge>
                </div>
              ))}
              {content.attachments.length === 0 ? <p className="font-body text-sm text-text-muted">Fayl yuklanmagan.</p> : null}
            </div>
          </Card>

          {content.status === "SUBMITTED" || content.status === "UNDER_REVIEW" ? (
            <Card>
              <CardHeader>
                <CardTitle>Harakatlar</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {content.status === "SUBMITTED" ? (
                  <Button size="sm" disabled={startReview.isPending} onClick={() => startReview.mutate(id)}>
                    Ko&apos;rib chiqishni boshlash
                  </Button>
                ) : null}
                {content.status === "UNDER_REVIEW" ? (
                  <>
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id, comment: undefined })}>
                      {approve.isPending ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setModal("request-changes")}>
                      O&apos;zgartirish so&apos;rash
                    </Button>
                    <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal("reject")}>
                      Rad etish
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sharhlar</CardTitle>
            </CardHeader>
            {content.comments.length === 0 ? (
              <p className="font-body text-sm text-text-muted">Hozircha sharh yo&apos;q.</p>
            ) : (
              <ul className="space-y-3">
                {content.comments.map((c) => (
                  <li key={c.id} className="border-b border-border pb-3 last:border-none last:pb-0">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone={contentReviewActionMeta[c.action].tone}>{contentReviewActionMeta[c.action].label}</Badge>
                      <span className="font-body text-xs text-text-muted">{new Date(c.createdAt).toLocaleDateString("uz-UZ")}</span>
                    </div>
                    <p className="font-body text-sm text-text-secondary">{c.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versiyalar tarixi</CardTitle>
            </CardHeader>
            {content.versions.length === 0 ? (
              <p className="font-body text-sm text-text-muted">Hali yuborilmagan.</p>
            ) : (
              <ul className="space-y-2">
                {content.versions.map((v) => (
                  <li key={v.id} className="font-body text-xs text-text-secondary">
                    <span className="font-medium text-text-primary">V{v.versionNumber}</span> — {new Date(v.submittedAt).toLocaleDateString("uz-UZ")}
                    {v.caption ? <p className="mt-0.5 text-text-primary">{v.caption}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "reject" ? "Contentni rad etish" : "O'zgartirish so'rash"}
        description="Izoh creatorga ko'rsatiladi."
        requireReason
        reasonLabel="Izoh"
        destructive={modal === "reject"}
        isPending={reject.isPending || requestChanges.isPending}
        onConfirm={async (reason) => {
          if (!reason) return;
          if (modal === "reject") await reject.mutateAsync({ id, reason });
          else if (modal === "request-changes") await requestChanges.mutateAsync({ id, reason });
          setModal(null);
        }}
      />
    </div>
  );
}
