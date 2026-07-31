"use client";

import { useState } from "react";
import type { DeliveryRegionPublic } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Skeleton } from "@sofsavdo/ui";
import { Truck } from "lucide-react";
import { useOfferQuote } from "@/services/offer";
import { RegionSelect } from "./RegionSelect";

// Only rendered for PHYSICAL_PRODUCT offers (see OfferLandingPageClient) — COURSE/DIGITAL/SERVICE
// offers never show a region selector, delivery fee, or shipping copy at all. The backend's
// POST /offers/:slug/quote is the sole source of truth for the total; this component never adds
// price + fee itself.
export function DeliveryQuoteBox({ offerSlug, deliveryRegions }: { offerSlug: string; deliveryRegions: DeliveryRegionPublic[] }) {
  const [regionCode, setRegionCode] = useState<string>(deliveryRegions[0]?.regionCode ?? "");
  const quote = useOfferQuote(offerSlug, regionCode || undefined, !!regionCode);

  if (deliveryRegions.length === 0) {
    return (
      <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
        <div className="flex items-start gap-3 rounded-card border border-border bg-bg p-5">
          <Truck className="size-5 shrink-0 text-text-secondary" />
          <p className="font-body text-sm text-text-secondary">Hozircha yetkazib berish hududlari sozlanmagan.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-page px-pad-mobile py-6 md:px-pad-desktop">
      <div className="space-y-3 rounded-card border border-border bg-bg p-5">
        <div className="flex items-center gap-2 font-body text-sm font-medium text-text-primary">
          <Truck className="size-5 text-text-secondary" /> Yetkazib berish hududi
        </div>
        <RegionSelect regions={deliveryRegions} value={regionCode} onChange={setRegionCode} />

        {quote.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : quote.data ? (
          <dl className="space-y-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Mahsulot narxi</dt>
              <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(quote.data.priceMinor, quote.data.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Yetkazib berish</dt>
              <dd className="font-numeric tabular-nums text-text-primary">
                {quote.data.deliveryFeeMinor === 0 ? "Bepul" : formatMoneyMinor(quote.data.deliveryFeeMinor, quote.data.currency)}
              </dd>
            </div>
            {quote.data.estimatedMinDays != null ? (
              <div className="flex justify-between">
                <dt className="text-text-secondary">Yetkazib berish muddati</dt>
                <dd className="text-text-primary">
                  {quote.data.estimatedMinDays}
                  {quote.data.estimatedMaxDays != null && quote.data.estimatedMaxDays !== quote.data.estimatedMinDays
                    ? `–${quote.data.estimatedMaxDays}`
                    : ""}{" "}
                  kun
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <dt className="text-text-primary">Jami</dt>
              <dd className="font-numeric tabular-nums text-accent">{formatMoneyMinor(quote.data.totalMinor, quote.data.currency)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
