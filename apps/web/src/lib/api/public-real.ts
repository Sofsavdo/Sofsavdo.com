// Real-backend implementation of the buyer-facing public API seam — counterpart to admin-real.ts,
// wired the same way through lib/api/index.ts behind NEXT_PUBLIC_API_MODE. Only getOfferPublic is
// backed by a real endpoint so far (the Landing domain's `GET /offers/:slug/public` — see API.md);
// checkout/orders/promo-code validation still throw until their own Phase 6B slices land.
import type { DeliveryRegionPublic, LandingSectionAdmin, Offer, OfferQuote, ProductType } from "@rosti/types";
import { apiRequest, ApiError } from "./http-client";

interface BackendPublicOfferVariant {
  id: string;
  name: string;
  priceMinor: number;
  isDefault: boolean;
}

// Shape returned by LandingsService.getPublicByOfferSlug() (apps/api/src/landings/landings.service.ts).
// Same `expiresAt` -> `endsAt` rename as admin-real.ts's mapBackendOffer, for the same reason.
interface BackendPublicOffer {
  id: string;
  productId: string;
  name: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  variants: BackendPublicOfferVariant[];
  bonuses: string[] | null;
  deliveryInfo: string | null;
  paymentOptions: string[];
  installmentOptions: string | null;
  ctaType: Offer["ctaType"];
  ctaLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: Offer["status"];
  availability: Offer["availability"];
  impliedDiscountBasisPoints: number;
}

interface BackendPublicLanding {
  offer: BackendPublicOffer;
  productType: ProductType;
  deliveryRegions: DeliveryRegionPublic[];
  landing: { template: string; seoTitle: string | null; seoDescription: string | null; seoKeywords: string[]; ogImageUrl: string | null };
  sections: LandingSectionAdmin[];
}

function mapBackendPublicOffer(o: BackendPublicOffer): Offer {
  return {
    id: o.id,
    productId: o.productId,
    name: o.name,
    slug: o.slug,
    headline: o.headline,
    subheadline: o.subheadline ?? "",
    priceMinor: o.priceMinor,
    compareAtPriceMinor: o.compareAtPriceMinor ?? undefined,
    currency: o.currency,
    variants: o.variants.map((v) => ({ id: v.id, name: v.name, priceMinor: v.priceMinor, isDefault: v.isDefault })),
    bonuses: o.bonuses ?? [],
    deliveryInfo: o.deliveryInfo ?? undefined,
    paymentOptions: o.paymentOptions,
    installmentOptions: o.installmentOptions ?? undefined,
    ctaType: o.ctaType,
    ctaLabel: o.ctaLabel ?? "",
    startsAt: o.startsAt ?? undefined,
    endsAt: o.endsAt ?? undefined,
    status: o.status,
    availability: o.availability,
    isIndexable: false,
    createdAt: new Date().toISOString(),
  };
}

// refCode isn't sent to the backend yet — referral attribution isn't part of this slice (see
// "Support future referral tracking without redesign" in PROJECT_STATUS.md); the public endpoint
// already returns everything a future `POST /referrals/track` call would need to correlate
// against, so no reshaping will be needed when that lands.
export async function getOfferPublic(
  slug: string,
  _refCode?: string,
): Promise<{ offer: Offer; productType: ProductType; deliveryRegions: DeliveryRegionPublic[]; sections: LandingSectionAdmin[] } | null> {
  try {
    const res = await apiRequest<BackendPublicLanding>(`/offers/${slug}/public`);
    return {
      offer: mapBackendPublicOffer(res.offer),
      productType: res.productType,
      deliveryRegions: res.deliveryRegions,
      sections: res.sections,
    };
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

// Authoritative price computation — never create an Order (see delivery.service.ts's quote()).
export async function getOfferQuote(slug: string, regionCode?: string): Promise<OfferQuote> {
  return apiRequest<OfferQuote>(`/offers/${slug}/quote`, { method: "POST", body: { regionCode } });
}
