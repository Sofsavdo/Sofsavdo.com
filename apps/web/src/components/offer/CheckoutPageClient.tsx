"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@sofsavdo/ui";
import { useOfferPublic, useCreateOrder, useValidatePromoCode, useTrackVisit } from "@/services/offer";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas";
import { RegionSelect } from "./RegionSelect";
import { UZ_DELIVERY_ZONES, UZ_VILOYATLAR } from "@/lib/uz-regions";
import { ApiError } from "@/lib/api";
import { useBuyerSession } from "@/services/buyerSession";
import { getMyAddresses } from "@/lib/api/buyer-real";

// Duck-typed rather than `instanceof ApiError`: `@/lib/api`'s barrel exports `MockApiError as
// ApiError` (mock mode has no real HTTP layer, so it was never given a statusCode), so the name
// `ApiError` in this file doesn't reliably refer to the real HTTP error class with a numeric
// statusCode — checking for the property directly works regardless of which concrete error class
// is actually involved. Missing/non-numeric statusCode (mock mode, or a network-level failure
// that never reached a real HTTP response) is treated the same as a real 5xx — both mean "not a
// specific validation rejection", which is the actual distinction this needs to make.
function isTransientCheckoutError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode !== "number" || statusCode >= 500;
}

export function CheckoutPageClient({ offerSlug }: { offerSlug: string }) {
  const searchParams = useSearchParams();
  const variantId = searchParams.get("variant");
  const refCode = searchParams.get("ref") ?? undefined;
  const router = useRouter();

  const offerQuery = useOfferPublic(offerSlug, refCode);
  const createOrder = useCreateOrder();
  const validatePromo = useValidatePromoCode();
  const trackVisit = useTrackVisit();

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountMinor: number } | null>(null);
  const [regionCode, setRegionCode] = useState("");
  const [visitorId, setVisitorId] = useState<string | undefined>(undefined);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | undefined>(undefined);
  const [idempotencyKey] = useState(() => `${offerSlug}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutInput>({ resolver: zodResolver(checkoutSchema) });

  // Phase F checkout UX improvement: a logged-in buyer's saved default address pre-fills the
  // form, so a repeat purchase doesn't mean retyping everything. This is pure convenience — the
  // buyer can still edit every field before submitting, and account linking itself already
  // happens automatically server-side (the checkout POST already carries the buyer's Bearer token
  // if one is in memory; see PublicCheckoutController's @OptionalAuth() route and
  // OrdersService.upsertCustomer). No new backend endpoint was needed for this — it's the exact
  // same GET /buyer/addresses Phase D already built for the Addresses page.
  const { user: buyerUser } = useBuyerSession();
  const buyerAddressesQuery = useQuery({
    queryKey: ["buyer-addresses"],
    queryFn: getMyAddresses,
    enabled: !!buyerUser,
  });

  useEffect(() => {
    if (!buyerUser) return;
    if (buyerUser.displayName) setValue("fullName", buyerUser.displayName);
    if (buyerUser.phone) setValue("phone", buyerUser.phone);
    const defaultAddress = buyerAddressesQuery.data?.find((a) => a.isDefault) ?? buyerAddressesQuery.data?.[0];
    if (defaultAddress) {
      setValue("address", defaultAddress.line1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerUser, buyerAddressesQuery.data]);

  // Records the page view against the ?ref= link (if any) once, on mount — see
  // POST /offers/:slug/visit / ReferralVisit in DECISIONS.md ADR-015. Never blocks rendering: an
  // unknown/expired code just means no attribution/discount suggestion, not an error.
  useEffect(() => {
    trackVisit.mutate(
      { offerSlug, refCode },
      {
        onSuccess: (result) => {
          setVisitorId(result.visitorId);
          setCreatorDisplayName(result.creatorDisplayName);
          if (result.promoCode) setPromoInput((current) => current || result.promoCode!);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSlug, refCode]);

  const offer = offerQuery.data?.offer;
  const productType = offerQuery.data?.productType;
  const deliveryRegions = offerQuery.data?.deliveryRegions ?? [];
  const variant = useMemo(
    () => offer?.variants.find((v) => v.id === variantId) ?? offer?.variants.find((v) => v.isDefault) ?? offer?.variants[0],
    [offer, variantId],
  );

  const isPhysical = productType === "PHYSICAL_PRODUCT";
  const selectedRegion = deliveryRegions.find((r) => r.regionCode === regionCode);
  const deliveryFeeMinor = isPhysical ? (selectedRegion?.deliveryFeeMinor ?? 0) : 0;

  // `deliveryRegions` only resolves after this component has already mounted once (the offer
  // query is still loading on the very first render, before `regionCode`'s `useState("")`
  // initializer ever runs) — without this, the region <select> visually shows its first option
  // (an ordinary uncontrolled-select fallback for a `value` that matches no `<option>`) while
  // `regionCode` itself silently stays "", and submitting would fail with REGION_REQUIRED despite
  // the UI looking like a region was already picked. Real bug caught in browser verification, not
  // guessed — matches the same class of select/value-mismatch bug already hit twice elsewhere in
  // this codebase (OfferForm's productId, CampaignForm's offerId).
  useEffect(() => {
    if (regionCode || deliveryRegions.length === 0) return;
    setRegionCode(deliveryRegions[0]!.regionCode);
  }, [regionCode, deliveryRegions]);

  // Payment is deliberately never shown or mentioned to the buyer right now — cash-on-delivery
  // by default, matching the 100k.uz reference the checkout form was rebuilt from. The field still
  // exists on the backend (Offer.paymentOptions/resolvePaymentProvider), so this picks whichever
  // configured option is safest without an online-payment promise: COD first, the installment
  // option next, and only falls back to an online method for the rare older offer that has
  // neither — better than breaking checkout entirely for those.
  useEffect(() => {
    if (!offer) return;
    const preferred = offer.paymentOptions.includes("COD")
      ? "COD"
      : offer.paymentOptions.includes("PAY_LATER")
        ? "PAY_LATER"
        : offer.paymentOptions[0];
    if (preferred) setValue("paymentMethod", preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer]);


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

  const totalMinor = Math.max(variant.priceMinor - (appliedPromo?.discountMinor ?? 0) + deliveryFeeMinor, 0);

  async function onApplyPromo() {
    if (!promoInput.trim()) return;
    try {
      const result = await validatePromo.mutateAsync({ offerSlug, code: promoInput.trim(), baseAmountMinor: variant!.priceMinor });
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
      visitorId,
      regionCode: isPhysical ? regionCode : undefined,
      paymentMethod: values.paymentMethod,
      customer: {
        fullName: values.fullName,
        phone: values.phone,
        secondPhone: values.secondPhone || undefined,
        // The backend's region-required check reads customer.region (a display name stored
        // straight onto Address), which is a different field from the top-level regionCode used
        // for delivery-fee lookup — both must be sent or physical orders get falsely rejected.
        region: isPhysical ? (selectedRegion?.regionName ?? regionCode) : undefined,
        address: values.address,
        email: values.email || undefined,
        comment: values.comment,
      },
      idempotencyKey,
    });
    // Click (and any future redirect-based provider) hands back an external payment URL — the
    // buyer completes payment there before Click's callback lands and moves the Order to PAID.
    // Pay Later/mock mode never sets this, so the internal order-success page is the fallback.
    if (order.paymentRedirectUrl) {
      window.location.assign(order.paymentRedirectUrl);
      return;
    }
    router.push(`/order-success/${order.publicToken}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-pad-mobile py-10 md:px-pad-desktop">
      <Link href={`/o/${offerSlug}`} className="font-body text-sm text-text-secondary hover:text-text-primary">
        ← Taklifga qaytish
      </Link>

      <Card className="mt-4">
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{offer.name}</CardTitle>
          <p className="font-body text-sm text-text-secondary">{variant.name}</p>
          {creatorDisplayName ? <p className="font-body text-xs text-accent">{creatorDisplayName} orqali</p> : null}
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <TextField label="Ism familiya" error={errors.fullName?.message} {...register("fullName")} />
          <TextField label="Telefon raqami" placeholder="+998 90 123 45 67" error={errors.phone?.message} {...register("phone")} />
          <TextField
            label="Qo'shimcha telefon (ixtiyoriy)"
            placeholder="+998 90 123 45 67"
            error={errors.secondPhone?.message}
            {...register("secondPhone")}
          />

          {/* Matches the 100k.uz reference this checkout was rebuilt from: name, phone, region —
              no street-address field. The courier confirms the exact address by phone after the
              order is placed, same as that reference flow; `address` (still optional on the
              backend/schema) is simply never collected here. */}
          {isPhysical && deliveryRegions.length > 0 ? (
            <div>
              <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Yetkazib berish hududi</p>
              <RegionSelect regions={deliveryRegions} value={regionCode} onChange={setRegionCode} />
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 font-body text-sm font-medium text-text-primary">Promo kod</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  setAppliedPromo(null);
                }}
                placeholder="Masalan: MALIKA10"
                className="h-10 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 font-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

          {/* LEGAL.md gap #1 — checkout previously had no ToS/Privacy links or consent at all;
              a customer could pay real money with zero acknowledgment of any policy. */}
          <label className="flex items-start gap-2 font-body text-sm text-text-secondary">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-border" {...register("termsAccepted")} />
            <span>
              Men{" "}
              <Link href="/legal/terms" target="_blank" className="text-accent underline">
                Foydalanish shartlari
              </Link>
              ,{" "}
              <Link href="/legal/privacy" target="_blank" className="text-accent underline">
                Maxfiylik siyosati
              </Link>{" "}
              va{" "}
              <Link href="/legal/refund-policy" target="_blank" className="text-accent underline">
                Qaytarish siyosati
              </Link>
              ni o&apos;qib chiqdim va roziman.
            </span>
          </label>
          {errors.termsAccepted ? <p className="-mt-2 font-body text-sm text-error">{errors.termsAccepted.message}</p> : null}

          <div className="rounded-input border border-border bg-bg p-4 font-body text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Narx</span>
              <span className="font-numeric tabular-nums">{formatMoneyMinor(variant.priceMinor, offer.currency)}</span>
            </div>
            {isPhysical ? (
              <div className="flex justify-between text-text-secondary">
                <span>Yetkazib berish</span>
                <span className="font-numeric tabular-nums">{deliveryFeeMinor === 0 ? "Bepul" : formatMoneyMinor(deliveryFeeMinor, offer.currency)}</span>
              </div>
            ) : null}
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

          {createOrder.isError ? (
            <Alert tone="error">
              {(createOrder.error as ApiError).message}
              {/* statusCode >= 500 (or missing — a network/timeout failure never reached a real
                  status) is a transient server-side problem where re-submitting the exact same
                  data is the correct next action; a 4xx is a real validation/business rejection
                  (e.g. stock, promo) where retrying unchanged input would just fail again the
                  same way — the copy should not tell someone to "just try again" in that case.
                  Either way, the button below is always safe to press again: `idempotencyKey`
                  is generated once per page load and reused across every submit attempt, so a
                  retry can never create a second Order for the same checkout. */}
              {isTransientCheckoutError(createOrder.error) ? (
                <span className="mt-1 block font-medium">Iltimos, birozdan so&apos;ng qayta urinib ko&apos;ring.</span>
              ) : null}
            </Alert>
          ) : null}

          <Button type="submit" size="lg" disabled={createOrder.isPending}>
            {createOrder.isPending
              ? "Yuborilmoqda..."
              : createOrder.isError
                ? "Qayta urinish"
                : `${offer.ctaLabel} — ${formatMoneyMinor(totalMinor, offer.currency)}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
