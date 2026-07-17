import { Suspense } from "react";
import { OfferLandingPageClient } from "@/components/offer/OfferLandingPageClient";

// Public, buyer-facing — will be server-rendered against real data + given real metadata in
// Phase 6/7 once this reads from apps/api instead of the mock store. For now it opts out of
// static prerendering (per-request `?ref=` personalization) rather than pretending to be static.
export const dynamic = "force-dynamic";

export default async function OfferLandingPage({ params }: { params: Promise<{ offerSlug: string }> }) {
  const { offerSlug } = await params;
  return (
    <Suspense fallback={null}>
      <OfferLandingPageClient offerSlug={offerSlug} />
    </Suspense>
  );
}
