"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Product } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, IconButton, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { productSchema, type ProductInput } from "@/lib/schemas-admin";
import { useCreateProduct, useUpdateProduct, useUploadImage } from "@/services/admin/catalog";
import { ApiError } from "@/lib/api/admin";
import { useRealCreatorList } from "@/services/admin/creators";

// title/shortDescription/description — the ProductAiDraft fields with a home in this form.
// features/benefits/etc still have nowhere to go here; see ProductAiDraftPanel's own review panel
// for those. DECISIONS.md ADR-028 originally scoped `description` out of this form entirely — it
// was AI-draftable but never actually persisted anywhere — revisited after real admin usage showed
// shortDescription's 500-char cap was being used (and hit) as the only home for full product
// storytelling, when `description` (the field the buyer-facing offer page's Hero actually renders)
// was sitting unused.
export interface ProductAiPrefill {
  title: string;
  shortDescription: string;
}

const PRODUCT_TYPES = [
  { value: "PHYSICAL_PRODUCT", label: "Fizik mahsulot" },
  { value: "DIGITAL_PRODUCT", label: "Raqamli mahsulot" },
  { value: "COURSE", label: "Kurs" },
  { value: "SERVICE", label: "Xizmat" },
  { value: "CONSULTATION", label: "Konsultatsiya" },
] as const;

export function ProductForm({
  existing,
  onCreated,
  aiPrefill,
}: {
  existing?: Product;
  onCreated?: (created: Product) => void;
  aiPrefill?: ProductAiPrefill;
}) {
  const router = useRouter();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const uploadImage = useUploadImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: creators } = useRealCreatorList({ pageSize: 1000 });
  // Before this, this form silently carried forward `existing?.images` with no way to actually
  // add or remove one — creating a new product always ended up with zero images, and editing one
  // could never change them. Real, editable state now; the admin uploads a file directly instead
  // of pasting an external image-hosting URL (see DECISIONS.md's Product Image Upload ADR).
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  // No dedicated video-upload endpoint exists (only /admin/uploads/image) — admin pastes a URL
  // instead, same convention as SectionEditor's CREATOR_VIDEO field: a direct file URL (.mp4) or
  // a YouTube link both work, since the buyer/creator-facing renderers already handle both.
  const [videos, setVideos] = useState<string[]>(existing?.videos ?? []);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          slug: existing.slug,
          type: existing.type,
          // Every one of these is a nullable DB column — the API genuinely returns `null` (not
          // omitted) when unset, but the zod schema's `.optional()` only accepts `undefined`, not
          // `null` ("Invalid input: expected string, received null"). Every nullable field loaded
          // into defaultValues needs this same `?? undefined` normalization.
          shortDescription: existing.shortDescription ?? undefined,
          description: existing.description ?? undefined,
          sku: existing.sku ?? undefined,
          costPriceMinor: existing.costPriceMinor ? String(existing.costPriceMinor / 100) : undefined,
          internalNotes: existing.internalNotes ?? undefined,
          creatorProfileId: (existing as any).creatorProfileId ?? undefined,
          featuredBadge: existing.featuredBadge ?? "",
          externalRedirectUrl: existing.externalRedirectUrl ?? "",
          estimatedEarningLabel: existing.estimatedEarningLabel ?? "",
        }
      : { type: "PHYSICAL_PRODUCT" },
  });

  // Explicit "Ishlatish" click in ProductAiDraftPanel is what triggers this, never automatic —
  // still just fills the form, the admin reviews/edits normally and clicks Save themselves.
  useEffect(() => {
    if (!aiPrefill) return;
    setValue("name", aiPrefill.title);
    setValue("shortDescription", aiPrefill.shortDescription);
  }, [aiPrefill, setValue]);

  const mutation = existing ? updateProduct : createProduct;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const url = await uploadImage.mutateAsync(file);
    setImages((prev) => [...prev, url]);
  }

  async function onSubmit(values: ProductInput) {
    const payload = {
      name: values.name,
      slug: values.slug,
      type: values.type,
      shortDescription: values.shortDescription,
      description: values.description,
      sku: values.sku || null,
      costPriceMinor: values.costPriceMinor ? Math.round(Number(values.costPriceMinor) * 100) : undefined,
      internalNotes: values.internalNotes,
      images,
      videos,
      attributes: existing?.attributes ?? [],
      creatorProfileId: values.creatorProfileId || null,
      featuredBadge: values.featuredBadge || null,
      externalRedirectUrl: values.externalRedirectUrl || null,
      estimatedEarningLabel: values.estimatedEarningLabel || null,
    };
    if (existing) {
      await updateProduct.mutateAsync({ id: existing.id, patch: payload });
      router.push(`/admin/products/${existing.id}`);
    } else {
      const created = await createProduct.mutateAsync(payload);
      if (onCreated) onCreated(created);
      else router.push(`/admin/products/${created.id}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{existing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Product faqat Offer yaratish uchun asos — o&apos;zi hech qachon buyerga ko&apos;rsatilmaydi.
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Nomi" error={errors.name?.message} {...register("name")} />
        <TextField label="Slug" error={errors.slug?.message} {...register("slug")} />
        <SelectField label="Turi" error={errors.type?.message} {...register("type")}>
          {PRODUCT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Qisqacha tavsif"
          hint="Mahsulot kartochkalarida ko'rinadigan qisqa sarlavha (1000 belgigacha)."
          error={errors.shortDescription?.message}
          rows={2}
          {...register("shortDescription")}
        />
        <TextAreaField
          label="To'liq tavsif"
          hint="Buyerga ko'rinadigan sahifada asosiy tavsif sifatida chiqadi — mahsulotni chuqurroq ochib bering (20000 belgigacha)."
          error={errors.description?.message}
          rows={8}
          {...register("description")}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="SKU" {...register("sku")} />
          <TextField label="Cost price (so'm)" type="number" {...register("costPriceMinor")} />
        </div>
        <SelectField label="Creator" error={errors.creatorProfileId?.message} {...register("creatorProfileId")}>
          <option value="">Creator tanlang (ixtiyoriy)</option>
          {creators?.items.map((creator) => (
            <option key={creator.id} value={creator.id}>
              {creator.displayName} ({creator.email})
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Belgi (Premium / VIP)"
          hint="Creatorlarga mahsulot ro'yxatida ko'rinadigan qo'shimcha yorliq — hech qanday shart-sharoitga ta'sir qilmaydi."
          {...register("featuredBadge")}
        >
          <option value="">Belgisiz</option>
          <option value="PREMIUM">Premium</option>
          <option value="VIP">VIP</option>
        </SelectField>
        <TextField
          label="Sherik platforma havolasi (ixtiyoriy)"
          hint="Bo'lsa, bu mahsulotning Flow havolasi Sofsavdo checkout o'rniga to'g'ridan-to'g'ri shu manzilga (masalan, Fidem Telegram botiga) yo'naltiradi."
          placeholder="https://t.me/Fidem_Appbot"
          error={errors.externalRedirectUrl?.message}
          {...register("externalRedirectUrl")}
        />
        <TextField
          label="Daromad taxmini (ixtiyoriy)"
          hint="Sherik platforma mahsulotlari uchun — creator-picker'da hisoblangan narx/komissiya o'rniga shu matn ko'rsatiladi."
          placeholder="17 500 – 29 900 so'm"
          error={errors.estimatedEarningLabel?.message}
          {...register("estimatedEarningLabel")}
        />
        <TextAreaField label="Ichki izohlar (faqat admin ko'radi)" {...register("internalNotes")} />

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Rasmlar</p>
          <div className="flex flex-wrap gap-3">
            {images.map((url, index) => (
              <div key={url} className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-input border border-border">
                <img src={url} alt="" className="size-full object-cover" />
                <IconButton
                  type="button"
                  aria-label="Rasmni o'chirish"
                  size="sm"
                  className="absolute right-1 top-1 bg-dark/60 text-white hover:bg-dark/80"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="size-3.5" />
                </IconButton>
              </div>
            ))}
            <button
              type="button"
              disabled={uploadImage.isPending}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-input border border-dashed border-border font-body text-xs text-text-muted hover:border-accent hover:text-accent"
            >
              {uploadImage.isPending ? "Yuklanmoqda..." : "+ Rasm yuklash"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
          {uploadImage.isError ? <p className="mt-1.5 font-body text-xs text-error">{(uploadImage.error as ApiError).message}</p> : null}
        </div>

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Videolar</p>
          {videos.length > 0 ? (
            <ul className="mb-2 flex flex-col gap-1.5">
              {videos.map((url, index) => (
                <li key={url} className="flex items-center gap-2 rounded-input border border-border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-text-secondary">{url}</span>
                  <IconButton
                    type="button"
                    aria-label="Videoni o'chirish"
                    size="sm"
                    onClick={() => setVideos((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="size-3.5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-end gap-2">
            <TextField
              label="Video havolasi"
              hint="To'g'ridan-to'g'ri video fayl manzili (.mp4) yoki YouTube havolasi."
              placeholder="https://... yoki https://youtube.com/watch?v=..."
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!newVideoUrl.trim()}
              onClick={() => {
                setVideos((prev) => [...prev, newVideoUrl.trim()]);
                setNewVideoUrl("");
              }}
            >
              Qo&apos;shish
            </Button>
          </div>
        </div>

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
