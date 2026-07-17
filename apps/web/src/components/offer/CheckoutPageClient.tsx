"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Button, Card, CardHeader, CardTitle, SelectField, Skeleton, TextAreaField, TextField } from "@rosti/ui";
import { useOfferPublic, useCreateOrder, useValidatePromoCode } from "@/services/offer";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { ApiError } from "@/lib/api";

export function CheckoutPageClient({ offerSlug }: { offerSlug: string }) {
  const searchParams = useSearchParams();
  const variantId = searchParams.get("variant");
  const refCode = searchParams.get("ref") ?? undefined;
  const router = useRouter();

  const offerQuery = useOfferPublic(offerSlug, refCode);
  const createOrder = useCreateOrder();
  const validatePromo = useValidatePromoCode();

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountMinor: number } | null>(null);
  const [idempotencyKey] = useState(() => `${offerSlug}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutInput>({ resolver: zodResolver(checkoutSchema) });

  const offer = offerQuery.data?.offer;
  const productType = offerQuery.data?.productType;
  const referral = offerQuery.data?.referral;
  const variant = useMemo(
    () => offer?.variants.find((v) => v.id === variantId) ?? offer?.variants.find((v) => v.isDefault) ?? offer?.variants[0],
    [offer, variantId],
  );

  // Auto-suggest the referral's promo code once, but the buyer can still clear/change it —
  // promo code and referral link can point at different creators (see ATTRIBUTION.md).
  useMemo(() => {
    if (referral?.promoCode && !promoInput) setPromoInput(referral.promoCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral?.promoCode]);

  if (offerQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-pad-mobile py-12 md:px-pad-desktop">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!offer || !variant) {
    return (
      <div className="mx-auto max-w-2xl px-pad-mobile py-20 text-center md:px-pad-desktop">
        <h1 className="font-heading text-xl font-bold text-text-primary">Taklif topilmadi</h1>
        <Link href="/" className="mt-3 inline-block font-body text-sm text-accent underline">
          Bosh sahifaga qaytish
        </Link>
      </div>
    );
  }

  const totalMinor = Math.max(variant.priceMinor - (appliedPromo?.discountMinor ?? 0), 0);

  async function onApplyPromo() {
    if (!promoInput.trim()) return;
    try {
      const result = await validatePromo.mutateAsync({ offerSlug, code: promoInput.trim() });
      setAppliedPromo({ code: result.code, discountMinor: result.discountMinor });
    } catch {
      setAppliedPromo(null);
    }
  }

  async function onSubmit(values: CheckoutInput) {
    const order = await createOrder.mutateAsync({
      offerSlug,
      variantId: variant!.id,
      promoCode: appliedPromo?.code,
      refCode,
      paymentMethod: values.paymentMethod,
      customer: {
        fullName: values.fullName,
        phone: values.phone,
        region: values.region,
        city: values.city,
        address: values.address,
        email: values.email || undefined,
        comment: values.comment,
      },
      idempotencyKey,
    });
    router.push(`/order-success/${order.publicToken}`);
  }

  const isPhysical = productType === "PHYSICAL_PRODUCT";

  return (
    <div className="mx-auto max-w-2xl px-pad-mobile py-10 md:px-pad-desktop">
      <Link href={`/o/${offerSlug}`} className="font-body text-sm text-text-secondary hover:text-text-primary">
        ← Taklifga qaytish
      </Link>

      <Card className="mt-4">
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{offer.name}</CardTitle>
          <p className="font-body text-sm text-text-secondary">{variant.name}</p>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <TextField label="To'liq ism" error={errors.fullName?.message} {...register("fullName")} />
          <TextField label="Telefon raqami" placeholder="+998 90 123 45 67" error={errors.phone?.message} {...register("phone")} />

          {isPhysical ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Viloyat" {...register("region")} />
                <TextField label="Shahar" {...register("city")} />
              </div>
              <TextAreaField label="Manzil" {...register("address")} />
            </>
          ) : (
            <TextField label="Email (ixtiyoriy)" type="email" error={errors.email?.message} {...register("email")} />
          )}

          {productType === "SERVICE" ? (
            <TextAreaField label="Qisqacha izoh (ixtiyoriy)" {...register("comment")} />
          ) : null}

          <div>
            <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Promo kod</p>
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  setAppliedPromo(null);
                }}
                placeholder="Masalan: MALIKA10"
                className="h-10 flex-1 rounded-input border border-border bg-surface px-3 font-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button type="button" variant="outline" onClick={onApplyPromo} disabled={validatePromo.isPending}>
                {validatePromo.isPending ? "..." : "Qo'llash"}
              </Button>
            </div>
            {validatePromo.isError ? (
              <p className="mt-1.5 font-body text-sm text-error">{(validatePromo.error as ApiError).message}</p>
            ) : appliedPromo ? (
              <p className="mt-1.5 font-body text-sm text-success">
                Promo kod qo&apos;llandi: −{formatMoneyMinor(appliedPromo.discountMinor, offer.currency)}
              </p>
            ) : null}
          </div>

          <SelectField label="To'lov usuli" error={errors.paymentMethod?.message} {...register("paymentMethod")}>
            <option value="">Tanlang</option>
            {offer.paymentOptions.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_METHOD_LABELS[p] ?? p}
              </option>
            ))}
          </SelectField>

          <div className="rounded-input border border-border bg-bg p-4 font-body text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Narx</span>
              <span className="font-numeric tabular-nums">{formatMoneyMinor(variant.priceMinor, offer.currency)}</span>
            </div>
            {appliedPromo ? (
              <div className="flex justify-between text-success">
                <span>Chegirma</span>
                <span className="font-numeric tabular-nums">−{formatMoneyMinor(appliedPromo.discountMinor, offer.currency)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium text-text-primary">
              <span>Jami</span>
              <span className="font-numeric text-lg tabular-nums">{formatMoneyMinor(totalMinor, offer.currency)}</span>
            </div>
          </div>

          {createOrder.isError ? <Alert tone="error">{(createOrder.error as ApiError).message}</Alert> : null}

          <Button type="submit" size="lg" disabled={createOrder.isPending}>
            {createOrder.isPending ? "Yuborilmoqda..." : `${offer.ctaLabel} — ${formatMoneyMinor(totalMinor, offer.currency)}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
