"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Offer } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, SelectField, TextAreaField, TextField } from "@sofsavdo/ui";
import { Plus, Trash2 } from "lucide-react";
import { offerSchema, type OfferInput } from "@/lib/schemas-admin";
import { useAdminProducts, useCreateOffer, useUpdateOffer } from "@/services/admin/catalog";
import { ApiError } from "@/lib/api/admin";

const CTA_TYPES = [
  { value: "BUY_NOW", label: "Buy Now" },
  { value: "ORDER_FORM", label: "Order Form" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "BOOK_CALL", label: "Book a Call" },
  { value: "PAY_INSTALLMENT", label: "Pay Installment" },
] as const;

// PAY_LATER (checkout's "bo'lib to'lash" / installment option) is fully wired end-to-end
// server-side (OrdersService.resolvePaymentProvider maps it to the MANUAL/human-reviewed
// provider) but had no way to be enabled on any Offer through this form — the only gap was here.
// UZUM_NASIYA is deliberately NOT listed: it has a Prisma enum value and display metadata but no
// real payment adapter or Uzum API integration exists yet (see DECISIONS.md) — listing it here
// would let an admin "enable" a payment method that silently can't actually process anything.
const PAYMENT_OPTIONS = ["CLICK", "PAYME", "CARD", "COD", "PAY_LATER"];

export function OfferForm({
  existing,
  defaultProductId,
  onCreated,
}: {
  existing?: Offer;
  defaultProductId?: string;
  onCreated?: (created: Offer) => void;
}) {
  const router = useRouter();
  const productsQuery = useAdminProducts();
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();

  const [variants, setVariants] = useState(existing?.variants ?? [{ id: "v1", name: "Standart", priceMinor: 0, isDefault: true }]);
  const [bonusesText, setBonusesText] = useState((existing?.bonuses ?? []).join("\n"));
  const [paymentOptions, setPaymentOptions] = useState<string[]>(existing?.paymentOptions ?? ["CLICK", "PAYME"]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OfferInput>({
    resolver: zodResolver(offerSchema),
    defaultValues: existing
      ? {
          productId: existing.productId,
          name: existing.name,
          slug: existing.slug,
          headline: existing.headline,
          subheadline: existing.subheadline,
          priceMinor: String(existing.priceMinor / 100),
          compareAtPriceMinor: existing.compareAtPriceMinor ? String(existing.compareAtPriceMinor / 100) : undefined,
          currency: existing.currency,
          ctaType: existing.ctaType,
          ctaLabel: existing.ctaLabel,
          deliveryInfo: existing.deliveryInfo,
          startsAt: existing.startsAt ? existing.startsAt.slice(0, 16) : undefined,
          endsAt: existing.endsAt ? existing.endsAt.slice(0, 16) : undefined,
        }
      : { productId: defaultProductId, currency: "UZS", ctaType: "BUY_NOW" },
  });

  const mutation = existing ? updateOffer : createOffer;

  // Products load async; a native <select> falls back to "Tanlang" (value "") when the default
  // value's <option> doesn't exist yet at mount, so re-apply once options are available — same
  // fix as CampaignForm's offer select (real bug found during Campaign browser verification).
  const productId = existing?.productId ?? defaultProductId;
  const productsLoaded = !!productsQuery.data;
  useEffect(() => {
    if (productsLoaded && productId) setValue("productId", productId);
  }, [productsLoaded, productId, setValue]);

  function updateVariant(index: number, patch: Partial<(typeof variants)[number]>) {
    setVariants((v) => v.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(values: OfferInput) {
    const payload = {
      productId: values.productId,
      name: values.name,
      slug: values.slug,
      headline: values.headline,
      subheadline: values.subheadline,
      priceMinor: Math.round(Number(values.priceMinor) * 100),
      compareAtPriceMinor: values.compareAtPriceMinor ? Math.round(Number(values.compareAtPriceMinor) * 100) : undefined,
      currency: values.currency,
      variants: variants.map((v) => ({ ...v, priceMinor: Math.round(Number(v.priceMinor)) })),
      bonuses: bonusesText.split("\n").map((b) => b.trim()).filter(Boolean),
      deliveryInfo: values.deliveryInfo,
      paymentOptions,
      ctaType: values.ctaType,
      ctaLabel: values.ctaLabel,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
    };
    if (existing) {
      await updateOffer.mutateAsync({ id: existing.id, patch: payload });
      router.push(`/admin/offers/${existing.id}`);
    } else {
      const created = await createOffer.mutateAsync(payload);
      if (onCreated) onCreated(created);
      else router.push(`/admin/offers/${created.id}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>{existing ? "Offerni tahrirlash" : "Yangi offer"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <SelectField label="Product" error={errors.productId?.message} {...register("productId")}>
          <option value="">Tanlang</option>
          {(productsQuery.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>

        <TextField label="Offer nomi" error={errors.name?.message} {...register("name")} />
        <TextField label="Slug (/o/... da ishlatiladi)" error={errors.slug?.message} {...register("slug")} />
        <TextField label="Headline" error={errors.headline?.message} {...register("headline")} />
        <TextAreaField label="Subheadline" error={errors.subheadline?.message} {...register("subheadline")} />

        <div className="grid grid-cols-3 gap-3">
          <TextField label="Narx (so'm)" error={errors.priceMinor?.message} {...register("priceMinor")} />
          <TextField label="Eski narx (ixtiyoriy)" {...register("compareAtPriceMinor")} />
          <TextField label="Currency" error={errors.currency?.message} {...register("currency")} />
        </div>

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Variantlar</p>
          <div className="flex flex-col gap-2">
            {variants.map((v, i) => (
              <div key={v.id} className="flex items-center gap-2">
                <input
                  value={v.name}
                  onChange={(e) => updateVariant(i, { name: e.target.value })}
                  placeholder="Variant nomi"
                  className="h-9 flex-1 rounded-input border border-border bg-surface px-3 font-body text-sm"
                />
                <input
                  type="number"
                  value={v.priceMinor / 100}
                  onChange={(e) => updateVariant(i, { priceMinor: Math.round(Number(e.target.value) * 100) })}
                  placeholder="Narx (so'm)"
                  className="h-9 w-36 rounded-input border border-border bg-surface px-3 font-body text-sm"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setVariants((list) => list.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-4 text-error" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setVariants((list) => [...list, { id: `v${Date.now()}`, name: "", priceMinor: 0, isDefault: false }])}
            >
              <Plus className="mr-1.5 size-4" /> Variant qo&apos;shish
            </Button>
          </div>
        </div>

        <TextAreaField
          label="Bonuslar (har birini yangi qatordan)"
          value={bonusesText}
          onChange={(e) => setBonusesText(e.target.value)}
        />

        <div>
          <p className="mb-1.5 font-body text-sm font-medium text-text-primary">To&apos;lov usullari</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 rounded-input border border-border px-3 py-1.5 font-body text-sm">
                <input
                  type="checkbox"
                  checked={paymentOptions.includes(opt)}
                  onChange={(e) =>
                    setPaymentOptions((list) => (e.target.checked ? [...list, opt] : list.filter((o) => o !== opt)))
                  }
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <TextField label="Yetkazib berish ma'lumoti (ixtiyoriy)" {...register("deliveryInfo")} />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Boshlanish sanasi (ixtiyoriy)"
            type="datetime-local"
            error={errors.startsAt?.message}
            {...register("startsAt")}
          />
          <TextField
            label="Tugash sanasi (ixtiyoriy)"
            type="datetime-local"
            error={errors.endsAt?.message}
            {...register("endsAt")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="CTA turi" error={errors.ctaType?.message} {...register("ctaType")}>
            {CTA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <TextField label="CTA matni" error={errors.ctaLabel?.message} {...register("ctaLabel")} />
        </div>

        {mutation.isError ? <Alert tone="error">{(mutation.error as ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Saqlanmoqda..." : existing ? "Saqlash" : "Yaratish"}
        </Button>
      </form>
    </Card>
  );
}
