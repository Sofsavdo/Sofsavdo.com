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

// Only title/shortDescription — the two ProductAiDraft fields that actually have a home in this
// form today. `description`/features/benefits/etc have nowhere to go here (ProductForm doesn't
// expose a `description` field at all yet); see ProductAiDraftPanel's own review panel for those,
// and DECISIONS.md ADR-028 for why this is a disclosed scoping choice, not an oversight.
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
          shortDescription: existing.shortDescription,
          sku: existing.sku,
          costPriceMinor: existing.costPriceMinor ? String(existing.costPriceMinor / 100) : undefined,
          internalNotes: existing.internalNotes,
          creatorProfileId: (existing as any).creatorProfileId,
          featuredBadge: existing.featuredBadge ?? "",
          externalRedirectUrl: existing.externalRedirectUrl ?? "",
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
      sku: values.sku,
      costPriceMinor: values.costPriceMinor ? Math.round(Number(values.costPriceMinor) * 100) : undefined,
      internalNotes: values.internalNotes,
      images,
      attributes: existing?.attributes ?? [],
      creatorProfileId: values.creatorProfileId,
      featuredBadge: values.featuredBadge || null,
      externalRedirectUrl: values.externalRedirectUrl || null,
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
        <TextAreaField label="Qisqacha tavsif" {...register("shortDescription")} />
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
        <TextAreaField label="Ichki izohlar (faqat admin ko'radi)" {...register("internalNotes")} />

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Rasmlar</p>
          <div className="flex flex-wrap gap-3">
            {images.map((url, index) => (
              <div key={url} className="relative size-24 overflow-hidden rounded-input border border-border">
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

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
