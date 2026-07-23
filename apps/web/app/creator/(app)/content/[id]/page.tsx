"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton, TextAreaField, TextField } from "@rosti/ui";
import { ArrowLeft, Paperclip, Trash2 } from "lucide-react";
import {
  useContentDetail,
  useUpdateContentDraft,
  useSubmitContentDraft,
  useResubmitContentDraft,
  useUploadContentAttachment,
  useDeleteContentAttachment,
} from "@/services/content";
import { realContentStatusMeta, contentReviewActionMeta } from "@/lib/status";
import { ApiError } from "@/lib/api";
import type { ContentAttachmentRole } from "@rosti/types";

const EDITABLE_STATUSES = new Set(["DRAFT", "CHANGES_REQUESTED"]);

export default function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useContentDetail(id);
  const updateMutation = useUpdateContentDraft();
  const submitMutation = useSubmitContentDraft();
  const resubmitMutation = useResubmitContentDraft();
  const uploadMutation = useUploadContentAttachment();
  const deleteAttachmentMutation = useDeleteContentAttachment();

  const [caption, setCaption] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string | null>(null);
  const [attachmentRole, setAttachmentRole] = useState<ContentAttachmentRole>("ATTACHMENT");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Alert tone="error">
        Content topilmadi.{" "}
        <Link href="/creator/content" className="underline">
          Ro&apos;yxatga qaytish
        </Link>
      </Alert>
    );
  }

  const content = query.data;
  const editable = EDITABLE_STATUSES.has(content.status);
  const requiredAttachmentCount = content.attachments.filter((a) => a.role === "ATTACHMENT").length;

  const captionValue = caption ?? content.caption ?? "";
  const notesValue = notes ?? content.notes ?? "";
  const hashtagsValue = hashtags ?? content.hashtags.join(", ");

  function saveDraft() {
    updateMutation.mutate({
      id,
      input: {
        caption: captionValue || undefined,
        notes: notesValue || undefined,
        hashtags: hashtagsValue
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean),
      },
    });
  }

  const submitError = submitMutation.isError ? (submitMutation.error as ApiError).message : null;
  const resubmitError = resubmitMutation.isError ? (resubmitMutation.error as ApiError).message : null;
  const uploadError = uploadMutation.isError ? (uploadMutation.error as ApiError).message : null;

  return (
    <div className="space-y-6">
      <Link href="/creator/content" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body text-sm text-text-muted">{content.campaign.name}</p>
          <h1 className="font-heading text-xl font-bold text-text-primary">Content #{content.currentVersionNumber || "qoralama"}</h1>
        </div>
        <Badge tone={realContentStatusMeta[content.status].tone}>{realContentStatusMeta[content.status].label}</Badge>
      </div>

      {content.changesRequestedReason ? (
        <Alert tone="warning">
          <strong>O&apos;zgartirish so&apos;raldi:</strong> {content.changesRequestedReason}
        </Alert>
      ) : null}
      {content.rejectionReason ? (
        <Alert tone="error">
          <strong>Rad etildi:</strong> {content.rejectionReason}
        </Alert>
      ) : null}
      {content.status === "EXPIRED" ? <Alert tone="warning">Kampaniya content muddati tugagan — bu content endi tahrirlanmaydi.</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Kontent tafsilotlari</CardTitle>
            </CardHeader>
            {editable ? (
              <div className="flex flex-col gap-4">
                <TextAreaField label="Caption" value={captionValue} onChange={(e) => setCaption(e.target.value)} />
                <TextAreaField label="Izohlar (faqat siz uchun)" value={notesValue} onChange={(e) => setNotes(e.target.value)} />
                <TextField
                  label="Hashtaglar (vergul bilan ajrating)"
                  value={hashtagsValue}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#ad, #beauty"
                />
                <Button variant="outline" size="sm" className="w-fit" disabled={updateMutation.isPending} onClick={saveDraft}>
                  {updateMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                </Button>
              </div>
            ) : (
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
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fayllar</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {content.attachments.map((a) => (
                <div key={a.id} className="relative space-y-1">
                  {a.attachmentType === "IMAGE" ? (
                    <img src={a.url} alt="" className="aspect-square w-full rounded-input border border-border object-cover" />
                  ) : (
                    <video src={a.url} controls className="aspect-square w-full rounded-input border border-border object-cover" />
                  )}
                  <Badge tone={a.role === "THUMBNAIL" ? "accent" : "neutral"}>{a.role === "THUMBNAIL" ? "Thumbnail" : "Fayl"}</Badge>
                  {editable ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-dark/60 p-1 text-white"
                      onClick={() => deleteAttachmentMutation.mutate(a.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {editable ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  value={attachmentRole}
                  onChange={(e) => setAttachmentRole(e.target.value as ContentAttachmentRole)}
                  className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
                >
                  <option value="ATTACHMENT">Fayl</option>
                  <option value="THUMBNAIL">Thumbnail (1080x1440)</option>
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate({ contentId: id, input: { file, role: attachmentRole } });
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                  <Paperclip className="mr-1.5 size-3.5" /> {uploadMutation.isPending ? "Yuklanmoqda..." : "Fayl yuklash"}
                </Button>
              </div>
            ) : null}
            {uploadError ? (
              <Alert tone="error" className="mt-3">
                {uploadError}
              </Alert>
            ) : null}
          </Card>

          {editable ? (
            <Card>
              <CardHeader>
                <CardTitle>Yuborish</CardTitle>
              </CardHeader>
              <p className="mb-3 font-body text-sm text-text-secondary">
                Yuborishdan oldin kamida bitta fayl biriktirilgan bo&apos;lishi kerak ({requiredAttachmentCount} ta fayl mavjud).
              </p>
              {submitError ? <Alert tone="error" className="mb-3">{submitError}</Alert> : null}
              {resubmitError ? <Alert tone="error" className="mb-3">{resubmitError}</Alert> : null}
              <Button
                disabled={submitMutation.isPending || resubmitMutation.isPending || requiredAttachmentCount === 0}
                onClick={() => (content.status === "CHANGES_REQUESTED" ? resubmitMutation.mutate(id) : submitMutation.mutate(id))}
              >
                {submitMutation.isPending || resubmitMutation.isPending
                  ? "Yuborilmoqda..."
                  : content.status === "CHANGES_REQUESTED"
                    ? "Qayta yuborish"
                    : "Tekshiruvga yuborish"}
              </Button>
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
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
