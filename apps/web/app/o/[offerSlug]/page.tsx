import { Suspense } from "react";
import type { Metadata } from "next";
import { getOfferPublic } from "@/lib/api";
import { BRAND } from "@sofsavdo/config/brand";
import { OfferLandingPageClient } from "@/components/offer/OfferLandingPageClient";

// Public, buyer-facing — server-rendered against real data. This opts out of static prerendering
// (per-request `?ref=` personalization) rather than pretending to be static.
export const dynamic = "force-dynamic";

// Each offer landing is the actual page a creator shares — a generic sitewide title/description
// on every one of them (what rendered here before this) means every shared link, browser tab, and
// search result looks identical regardless of what's being sold. The backend already computes a
// seoTitle/seoDescription/ogImageUrl per offer (LandingsService) — this was simply never read.
export async function generateMetadata({ params }: { params: Promise<{ offerSlug: string }> }): Promise<Metadata> {
  const { offerSlug } = await params;
  const data = await getOfferPublic(offerSlug).catch(() => null);
  if (!data) return { title: BRAND.name, description: `${BRAND.name} orqali xarid qiling.` };

  const title = data.seo.title || data.offer.headline || data.offer.name;
  const description = data.seo.description || data.offer.subheadline || `${data.offer.name} — ${BRAND.name} orqali xarid qiling.`;

  return {
    title,
    description,
    keywords: data.seo.keywords.length > 0 ? data.seo.keywords : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      images: data.seo.ogImageUrl ? [{ url: data.seo.ogImageUrl }] : undefined,
    },
    twitter: {
      card: data.seo.ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: data.seo.ogImageUrl ? [data.seo.ogImageUrl] : undefined,
    },
  };
}

export default async function OfferLandingPage({ params }: { params: Promise<{ offerSlug: string }> }) {
  const { offerSlug } = await params;
  return (
    <Suspense fallback={null}>
      <OfferLandingPageClient offerSlug={offerSlug} />
    </Suspense>
  );
}
