"use client";

import { useRef, useState } from "react";
import type { CampaignMediaItem, CampaignMediaRole } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle } from "@rosti/ui";
import { ArrowDown, ArrowUp, Image as ImageIcon, Star, Trash2, Upload, Video } from "lucide-react";
import {
  useCampaignMedia,
  useDeleteCampaignMedia,
  useReorderCampaignMedia,
  useReplaceCampaignCover,
  useSetCampaignMediaCover,
  useUploadCampaignMedia,
} from "@/services/admin/campaign-media";
import { ApiError } from "@/lib/api/admin";

const ROLE_LABELS: Record<CampaignMediaRole, string> = { COVER: "Cover", GALLERY: "Galereya", PROMOTIONAL: "Promo material" };

// Standard frame the backend enforces server-side (media-validation.ts) — shown here so an admin
// picks the right file before an upload gets rejected.
const FRAME_HINT = "1080 × 1440 (3:4 portret)";

export function CampaignMediaManager({ campaignId }: { campaignId: string }) {
  const mediaQuery = useCampaignMedia(campaignId);
  const uploadMutation = useUploadCampaignMedia(campaignId);
  const replaceCoverMutation = useReplaceCampaignCover(campaignId);
  const setCoverMutation = useSetCampaignMediaCover(campaignId);
  const reorderMutation = useReorderCampaignMedia(campaignId);
  const deleteMutation = useDeleteCampaignMedia(campaignId);

  const [uploadRole, setUploadRole] = useState<CampaignMediaRole>("GALLERY");
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const media = mediaQuery.data ?? [];
  const cover = media.find((m) => m.mediaRole === "COVER");
  const others = media.filter((m) => m.mediaRole !== "COVER").sort((a, b) => a.sortOrder - b.sortOrder);

  const error =
    (uploadMutation.error as ApiError | null) ??
    (replaceCoverMutation.error as ApiError | null) ??
    (setCoverMutation.error as ApiError | null) ??
    (reorderMutation.error as ApiError | null) ??
    (deleteMutation.error as ApiError | null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(true);
    try {
      await uploadMutation.mutateAsync({ file, mediaRole: uploadRole });
    } finally {
      setUploadProgress(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReplaceCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(true);
    try {
      await replaceCoverMutation.mutateAsync({ file, mediaRole: "COVER" });
    } finally {
      setUploadProgress(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  function move(id: string, direction: -1 | 1) {
    const index = others.findIndex((m) => m.id === id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= others.length) return;
    const reordered = [...others];
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;
    reorderMutation.mutate(reordered.map((m) => m.id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kampaniya media</CardTitle>
      </CardHeader>
      <p className="mb-3 font-body text-xs text-text-muted">Standart o&apos;lcham: {FRAME_HINT}. Rasm: JPEG/PNG/WEBP. Video: MP4/WEBM/MOV.</p>

      {error ? <Alert tone="error" className="mb-3">{error.message}</Alert> : null}

      <div className="mb-4 space-y-2 rounded-input border border-border p-3">
        <p className="font-body text-sm font-medium text-text-primary">Cover rasm</p>
        {cover ? (
          <div className="flex items-center gap-3">
            <img src={cover.url} alt={cover.altText ?? ""} className="h-24 w-18 rounded-input border border-border object-cover" />
            <div className="flex-1">
              <Badge tone="success">Cover o&apos;rnatilgan</Badge>
            </div>
          </div>
        ) : (
          <p className="font-body text-xs text-text-muted">Hozircha cover rasm yo&apos;q.</p>
        )}
        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleReplaceCover} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadProgress}
          onClick={() => coverInputRef.current?.click()}
        >
          <Upload className="mr-1.5 size-4" /> {cover ? "Coverni almashtirish" : "Cover yuklash"}
        </Button>
      </div>

      <div className="mb-4 flex items-end gap-2 rounded-input border border-border p-3">
        <div>
          <label htmlFor="media-role" className="mb-1 block font-body text-xs text-text-muted">
            Rol
          </label>
          <select
            id="media-role"
            value={uploadRole}
            onChange={(e) => setUploadRole(e.target.value as CampaignMediaRole)}
            className="h-9 rounded-input border border-border bg-bg px-2 font-body text-sm"
          >
            <option value="GALLERY">Galereya</option>
            <option value="PROMOTIONAL">Promo material</option>
          </select>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="outline" size="sm" disabled={uploadProgress} onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 size-4" /> {uploadProgress ? "Yuklanmoqda..." : "Media qo'shish"}
        </Button>
      </div>

      {others.length === 0 ? (
        <p className="font-body text-sm text-text-muted">Galereya/promo materiallar yo&apos;q.</p>
      ) : (
        <ul className="divide-y divide-border rounded-input border border-border">
          {others.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3 p-2.5">
              {m.mediaType === "IMAGE" ? (
                <img src={m.url} alt={m.altText ?? ""} className="h-14 w-14 rounded-input border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-input border border-border bg-bg">
                  <Video className="size-6 text-text-muted" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-body text-xs text-text-muted">
                  {m.mediaType === "IMAGE" ? <ImageIcon className="size-3.5" /> : <Video className="size-3.5" />}
                  {ROLE_LABELS[m.mediaRole]}
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => move(m.id, -1)} aria-label="Yuqoriga">
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={i === others.length - 1} onClick={() => move(m.id, 1)} aria-label="Pastga">
                <ArrowDown className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCoverMutation.mutate(m.id)} aria-label="Cover qilish">
                <Star className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/10"
                onClick={() => deleteMutation.mutate(m.id)}
                aria-label="O'chirish"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
