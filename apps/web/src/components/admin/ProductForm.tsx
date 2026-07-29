"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Product } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { productSchema, type ProductInput } from "@/lib/schemas-admin";
import { useCreateProduct, useUpdateProduct } from "@/services/admin/catalog";
import { ApiError } from "@/lib/api/admin";

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

  async function onSubmit(values: ProductInput) {
    const payload = {
      name: values.name,
      slug: values.slug,
      type: values.type,
      shortDescription: values.shortDescription,
      sku: values.sku,
      costPriceMinor: values.costPriceMinor ? Math.round(Number(values.costPriceMinor) * 100) : undefined,
      internalNotes: values.internalNotes,
      images: existing?.images ?? [],
      attributes: existing?.attributes ?? [],
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
        <TextAreaField label="Ichki izohlar (faqat admin ko'radi)" {...register("internalNotes")} />

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
