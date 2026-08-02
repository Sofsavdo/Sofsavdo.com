// Real-backend implementation of the buyer-facing public API seam — counterpart to admin-real.ts,
// wired the same way through lib/api/index.ts behind NEXT_PUBLIC_API_MODE. Only getOfferPublic is
// backed by a real endpoint so far (the Landing domain's `GET /offers/:slug/public` — see API.md);
// checkout/orders/promo-code validation still throw until their own Phase 6B slices land.
import type { DeliveryRegionPublic, LandingSectionAdmin, Offer, OfferQuote, ProductType } from "@sofsavdo/types";
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
export interface OfferSeoMeta {
  title?: string;
  description?: string;
  keywords: string[];
  ogImageUrl?: string;
}

export async function getOfferPublic(
  slug: string,
  _refCode?: string,
): Promise<{ offer: Offer; productType: ProductType; deliveryRegions: DeliveryRegionPublic[]; sections: LandingSectionAdmin[]; seo: OfferSeoMeta } | null> {
  try {
    const res = await apiRequest<BackendPublicLanding>(`/offers/${slug}/public`, { skipAuth: true });
    return {
      offer: mapBackendPublicOffer(res.offer),
      productType: res.productType,
      deliveryRegions: res.deliveryRegions,
      sections: res.sections,
      seo: {
        title: res.landing.seoTitle ?? undefined,
        description: res.landing.seoDescription ?? undefined,
        keywords: res.landing.seoKeywords,
        ogImageUrl: res.landing.ogImageUrl ?? undefined,
      },
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

// Shape returned by OffersService.listFeaturedPublic() (apps/api/src/offers/offers.service.ts) —
// deliberately narrower than Offer (no variants, no CTA/delivery config): this is a homepage
// teaser card, not a full landing page.
export interface FeaturedOffer {
  id: string;
  slug: string;
  name: string;
  headline: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
}

// Real-backend only, like Content (Phase 7A) — this is a brand-new public surface (Phase C's
// Commerce Home), so there's no legacy mock behavior to preserve behind NEXT_PUBLIC_API_MODE.
export async function getFeaturedOffers(): Promise<FeaturedOffer[]> {
  return apiRequest<FeaturedOffer[]>("/offers/featured", { skipAuth: true });
}

// Shape returned by OffersService.listCatalog() (Phase E) — same public-safe shape as
// FeaturedOffer plus productType, since /catalog lets a buyer filter by it.
export interface CatalogOffer extends FeaturedOffer {
  productType: string;
}

export interface CatalogQuery {
  page?: number;
  type?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
}

export interface PaginatedCatalog {
  items: CatalogOffer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Real-backend only — the catalog is a brand-new public surface, no legacy mock to preserve.
export async function getCatalog(query: CatalogQuery = {}): Promise<PaginatedCatalog> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.type) params.set("type", query.type);
  if (query.minPriceMinor != null) params.set("minPriceMinor", String(query.minPriceMinor));
  if (query.maxPriceMinor != null) params.set("maxPriceMinor", String(query.maxPriceMinor));
  const qs = params.toString();
  return apiRequest<PaginatedCatalog>(`/offers/catalog${qs ? `?${qs}` : ""}`, { skipAuth: true });
}

// Shape returned by HomepageSectionsService.listPublic() (Phase H) — already filtered to LIVE
// (active + within any scheduling window) sections only, in display order. `type` is one of the
// literal HomepageSectionType values; kept as `string` here rather than importing the Prisma enum
// across the API boundary, same convention as CatalogOffer's `productType`.
export interface HomepageSection {
  type: string;
  sortOrder: number;
  content: Record<string, unknown>;
}

// Real-backend only — the Homepage CMS is a brand-new public surface, no legacy mock to preserve.
export async function getHomepageSections(): Promise<HomepageSection[]> {
  return apiRequest<HomepageSection[]>("/homepage", { skipAuth: true });
}

// Shape returned by PublicActivityService.getRecentActivity() — see that file's own comment for
// why this never carries a creator name, an amount, or anything Commission-related.
export interface PublicActivityEvent {
  offerName: string;
  city: string | null;
  occurredAt: string;
}

// Real-backend only — brand-new public surface (homepage FOMO ticker), no legacy mock to preserve.
export async function getRecentActivity(): Promise<PublicActivityEvent[]> {
  return apiRequest<PublicActivityEvent[]>("/public/recent-activity", { skipAuth: true });
}
