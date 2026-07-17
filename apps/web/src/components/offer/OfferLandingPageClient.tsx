"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@rosti/ui";
import { useOfferPublic } from "@/services/offer";
import { LandingSectionRenderer, ReferralBanner, StickyMobileCta } from "./sections";

// The single most important negative-space rule on this page: there is no link anywhere in this
// tree to any other offer, product, course, or a catalog — a buyer who arrives here can only buy
// this one thing or leave. See docs/PROHIBITED.md.
export function OfferLandingPageClient({ offerSlug }: { offerSlug: string }) {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") ?? undefined;
  const router = useRouter();

  const query = useOfferPublic(offerSlug, refCode);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-page space-y-6 px-pad-mobile py-12 md:px-pad-desktop">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!query.data?.offer) {
    return (
      <div className="mx-auto max-w-page px-pad-mobile py-20 text-center md:px-pad-desktop">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Taklif topilmadi</h1>
        <p className="mt-2 font-body text-text-secondary">
          Bu havola muddati o&apos;tgan yoki noto&apos;g&apos;ri bo&apos;lishi mumkin.
        </p>
      </div>
    );
  }

  const { offer, sections, referral } = query.data;
  const activeVariantId = selectedVariantId ?? offer.variants.find((v) => v.isDefault)?.id ?? offer.variants[0]?.id ?? "";
  const activeVariant = offer.variants.find((v) => v.id === activeVariantId) ?? offer.variants[0]!;

  function goToCheckout() {
    const qs = new URLSearchParams();
    qs.set("variant", activeVariantId);
    if (refCode) qs.set("ref", refCode);
    router.push(`/checkout/${offerSlug}?${qs.toString()}`);
  }

  return (
    <div className="pb-20 md:pb-0">
      <header className="border-b border-border bg-surface px-pad-mobile py-3 md:px-pad-desktop">
        <Link href="/" className="font-heading text-lg font-bold text-text-primary">
          Rosti
        </Link>
      </header>

      {referral ? <ReferralBanner referral={referral} /> : null}

      {sections.map((section) => (
        <LandingSectionRenderer
          key={section.id}
          offer={offer}
          section={section}
          selectedVariantId={activeVariantId}
          onSelectVariant={setSelectedVariantId}
          onBuyClick={goToCheckout}
        />
      ))}

      <footer className="border-t border-border bg-surface px-pad-mobile py-6 text-center font-body text-xs text-text-muted md:px-pad-desktop">
        <p>Rosti · Aloqa: support@rosti.uz · Shartlar · Maxfiylik · Qaytarish siyosati</p>
      </footer>

      <StickyMobileCta
        price={activeVariant.priceMinor}
        currency={offer.currency}
        ctaLabel={offer.ctaLabel}
        onBuyClick={goToCheckout}
      />
    </div>
  );
}
