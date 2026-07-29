"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CreatorContent, CreatorCampaign } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { Paperclip, X } from "lucide-react";
import { contentStatusMeta } from "@/lib/status";
import { contentSubmitSchema, type ContentSubmitInput } from "@/lib/schemas";
import { useSubmitContent } from "@/services/content";

type FormValues = ContentSubmitInput;

export function ContentCard({
  creatorCampaign,
  content,
}: {
  creatorCampaign: CreatorCampaign;
  content?: CreatorContent;
}) {
  const submitMutation = useSubmitContent();
  const [fileNames, setFileNames] = useState<string[]>(content?.draftFileNames ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(contentSubmitSchema),
    defaultValues: {
      caption: content?.caption ?? "",
      platform: content?.platform ?? creatorCampaign.campaign.platforms[0],
      publishedUrl: content?.publishedUrl ?? "",
    },
  });

  const status = content?.status ?? "DRAFT";
  const editable = status === "DRAFT" || status === "REVISION_REQUESTED";

  async function onSubmit(values: FormValues) {
    if (!values.platform) return;
    await submitMutation.mutateAsync({
      creatorCampaignId: creatorCampaign.id,
      campaignName: creatorCampaign.campaign.name,
      caption: values.caption,
      platform: values.platform,
      draftFileNames: fileNames,
    });
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <div className="flex w-full items-center justify-between">
          <CardTitle>{creatorCampaign.campaign.name}</CardTitle>
          <Badge tone={contentStatusMeta[status].tone}>{contentStatusMeta[status].label}</Badge>
        </div>
      </CardHeader>

      {status === "REVISION_REQUESTED" && content?.reviewNote ? (
        <Alert tone="warning" className="mb-4">
          <strong>Admin izohi:</strong> {content.reviewNote}
        </Alert>
      ) : null}

      {editable ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <TextAreaField label="Caption" error={errors.caption?.message} {...register("caption")} />
          <SelectField label="Platforma" error={errors.platform?.message} {...register("platform")}>
            {creatorCampaign.campaign.platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectField>
          <TextField
            label="E'lon qilingan havola (ixtiyoriy, keyinroq qo'shsangiz ham bo'ladi)"
            placeholder="https://instagram.com/..."
            error={errors.publishedUrl?.message}
            {...register("publishedUrl")}
          />

          <div>
            <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Draft fayllar</p>
            <div className="flex flex-wrap gap-2">
              {fileNames.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 rounded-input border border-border bg-bg px-2.5 py-1 font-body text-xs text-text-secondary"
                >
                  <Paperclip className="size-3" /> {name}
                  <button type="button" onClick={() => setFileNames((f) => f.filter((n) => n !== name))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setFileNames((f) => [...f, file.name]);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
              Fayl yuklash
            </Button>
          </div>

          {submitMutation.isError ? <Alert tone="error">Yuborishda xatolik yuz berdi.</Alert> : null}

          <Button type="submit" disabled={submitMutation.isPending} className="w-fit">
            {submitMutation.isPending ? "Yuborilmoqda..." : "Tekshiruvga yuborish"}
          </Button>
        </form>
      ) : (
        <div className="space-y-2 font-body text-sm text-text-secondary">
          <p>{content?.caption}</p>
          {content?.publishedUrl ? (
            <a href={content.publishedUrl} className="text-accent underline" target="_blank" rel="noreferrer">
              E&apos;lon qilingan post
            </a>
          ) : null}
        </div>
      )}

      {content && content.history.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 font-body text-xs font-medium text-text-muted">Tarix</p>
          <ul className="space-y-1.5">
            {content.history.map((h, i) => (
              <li key={i} className="flex items-center justify-between font-body text-xs text-text-secondary">
                <span>
                  {contentStatusMeta[h.status].label}
                  {h.note ? ` — ${h.note}` : ""}
                </span>
                <span className="text-text-muted">{new Date(h.at).toLocaleDateString("uz-UZ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
