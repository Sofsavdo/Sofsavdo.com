// Real-backend implementation of the admin API seam — same function names/signatures as
// mocks/store.ts's apiAdmin* functions, re-exported through lib/api/admin.ts behind
// NEXT_PUBLIC_API_MODE so services/*.ts and every component never change. Only the auth
// functions and the Product domain are wired for real here — every other admin function still
// throws (loudly, not silently falling back to mock behavior) until its own Phase 6B domain slice
// lands, per the vertical-slice migration order in PROJECT_STATUS.md.
import type {
  AdminRole,
  AdminUser,
  Campaign,
  CampaignApplicationAdminView,
  CampaignMediaItem,
  CampaignMediaRole,
  CampaignMediaType,
  ContentAdminView,
  ContentAttachmentItem,
  ContentAttachmentType,
  ContentCommentItem,
  ContentReviewAction,
  ContentStatus,
  LandingPage,
  LandingSectionAdmin,
  LandingSectionType,
  Offer,
  Product,
  ProductStatus,
  RealAdminOrder,
} from "@rosti/types";
import { apiRequest, setAccessToken, ApiError } from "./http-client";
import type { CreateCampaignInput, CreateLandingInput, CreateOfferInput } from "../../mocks/store";

interface BackendSessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  roleKeys: string[];
  creatorId: string | null;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// The real `User` model backing staff accounts has no display-name field — only `CreatorProfile`
// does (see schema.prisma). The frontend's `AdminUser.displayName` was designed assuming every
// admin account has one; deriving it from the email's local part is a pragmatic adapter-layer
// shim, not a real fix. Flagged in PROJECT_STATUS.md as a Medium finding for whichever 6B/6D
// slice next touches the Users/Roles domain (add a real display name field, or drop the frontend
// field and show the email instead).
function mapSessionUserToAdminUser(user: BackendSessionUser): AdminUser {
  const role = mapRoleKeysToAdminRole(user.roleKeys);
  const displayName = user.email?.split("@")[0] ?? user.phone ?? "Admin";
  return { id: user.id, email: user.email ?? "", displayName, role };
}

function mapRoleKeysToAdminRole(roleKeys: string[]): AdminRole {
  if (roleKeys.includes("super_admin")) return "SUPER_ADMIN";
  if (roleKeys.includes("admin")) return "ADMIN";
  if (roleKeys.includes("manager")) return "MANAGER";
  throw new ApiError("FORBIDDEN", "Sizda admin panelga kirish huquqi yo'q.", 403);
}

export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  const result = await apiRequest<{ accessToken: string; user: BackendSessionUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setAccessToken(result.accessToken);
  return mapSessionUserToAdminUser(result.user);
}

// On a fresh page load there's no in-memory access token — apiRequest's built-in 401-then-refresh
// handling (see http-client.ts) recovers the session from the HttpOnly refresh cookie
// automatically, so this needs no separate "bootstrap" step. A genuinely logged-out visitor (no
// valid cookie either) gets a real 401 here, mapped to `null` rather than thrown, since this is a
// session-presence check, not a hard requirement.
export async function adminGetSession(): Promise<AdminUser | null> {
  try {
    const user = await apiRequest<BackendSessionUser>("/auth/me");
    return mapSessionUserToAdminUser(user);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 401) return null;
    throw err;
  }
}

export async function adminLogout(): Promise<void> {
  setAccessToken(null);
  await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
}

export async function adminDevSwitchRole(): Promise<AdminUser> {
  throw new ApiError("FORBIDDEN", "Role switching faqat mock rejimida ishlaydi.", 403);
}

export async function getProducts(): Promise<Product[]> {
  const res = await apiRequest<PaginatedResponse<Product>>("/admin/products");
  return res.items;
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    return await apiRequest<Product>(`/admin/products/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function createProduct(
  input: Omit<Product, "id" | "createdAt" | "status"> & { status?: ProductStatus },
): Promise<Product> {
  return apiRequest<Product>("/admin/products", { method: "POST", body: input });
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}`, { method: "PATCH", body: patch });
}

export async function archiveProduct(id: string): Promise<Product> {
  return apiRequest<Product>(`/admin/products/${id}/archive`, { method: "POST" });
}

// ---- Offers ----

interface BackendOfferVariant {
  id: string;
  name: string;
  priceMinor: number;
  isDefault: boolean;
  sortOrder: number;
}

// Shape returned by OffersService.toResponse() (apps/api/src/offers/offers.service.ts). The
// backend's `expiresAt` becomes the frontend's `endsAt` here — the rename happened only on the
// frontend side back when this was mock-only, and re-aligning the mock's field name across every
// existing component wasn't worth it for this slice, so the adapter absorbs the mismatch instead.
interface BackendOffer {
  id: string;
  productId: string;
  name: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  variants: BackendOfferVariant[];
  bonuses: string[];
  deliveryInfo: string | null;
  paymentOptions: string[];
  installmentOptions: string | null;
  ctaType: Offer["ctaType"];
  ctaLabel: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  status: Offer["status"];
  availability: Offer["availability"];
  isIndexable: boolean;
  createdAt: string;
}

function mapBackendOffer(o: BackendOffer): Offer {
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
    bonuses: o.bonuses,
    deliveryInfo: o.deliveryInfo ?? undefined,
    paymentOptions: o.paymentOptions,
    installmentOptions: o.installmentOptions ?? undefined,
    ctaType: o.ctaType,
    ctaLabel: o.ctaLabel ?? "",
    startsAt: o.startsAt ?? undefined,
    endsAt: o.expiresAt ?? undefined,
    status: o.status,
    availability: o.availability,
    isIndexable: o.isIndexable,
    createdAt: o.createdAt,
  };
}

// `id` on each variant is a client-side React-list key (see OfferForm.tsx) that mock mode also
// uses as its variant identity — the real backend's OfferVariantDto is whitelist-validated and
// rejects any unknown property, so it has to be stripped here rather than at the form layer.
function mapOfferInputToBackend(
  input: object & { endsAt?: string; variants?: { id?: string; name: string; priceMinor: number; isDefault?: boolean }[] },
  opts: { stripProductId: boolean },
): Record<string, unknown> {
  const { endsAt, variants, ...rest } = input;
  const out: Record<string, unknown> = {
    ...rest,
    expiresAt: endsAt,
    ...(variants ? { variants: variants.map(({ id: _id, ...v }) => v) } : {}),
  };
  // Server-only/computed fields a Partial<Offer> patch may carry — the backend DTOs are
  // whitelist-validated (forbidNonWhitelisted), so an unknown property is a hard 400.
  // `productId` is create-only: UpdateOfferDto deliberately omits it (immutable after creation),
  // so it must be stripped from updates — found as a real bug during Campaign browser
  // verification (real-mode Offer form edits 400'd), same class as the variant-id bug.
  for (const field of ["id", "status", "availability", "archivedAt", "createdAt", "impliedDiscountBasisPoints", "product"]) {
    delete out[field];
  }
  if (opts.stripProductId) delete out.productId;
  return out;
}

export async function getOffers(): Promise<Offer[]> {
  const res = await apiRequest<PaginatedResponse<BackendOffer>>("/admin/offers");
  return res.items.map(mapBackendOffer);
}

export async function getOffer(id: string): Promise<Offer | null> {
  try {
    return mapBackendOffer(await apiRequest<BackendOffer>(`/admin/offers/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  return mapBackendOffer(
    await apiRequest<BackendOffer>("/admin/offers", { method: "POST", body: mapOfferInputToBackend(input, { stripProductId: false }) }),
  );
}

export async function updateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
  return mapBackendOffer(
    await apiRequest<BackendOffer>(`/admin/offers/${id}`, { method: "PATCH", body: mapOfferInputToBackend(patch, { stripProductId: true }) }),
  );
}

export async function activateOffer(id: string): Promise<Offer> {
  return mapBackendOffer(await apiRequest<BackendOffer>(`/admin/offers/${id}/activate`, { method: "POST" }));
}

export async function pauseOffer(id: string): Promise<Offer> {
  return mapBackendOffer(await apiRequest<BackendOffer>(`/admin/offers/${id}/pause`, { method: "POST" }));
}

export async function archiveOffer(id: string): Promise<Offer> {
  return mapBackendOffer(await apiRequest<BackendOffer>(`/admin/offers/${id}/archive`, { method: "POST" }));
}

// ---- Landings ----
// Backend's LandingResponse/LandingSectionResponse (apps/api/src/landings/landings.service.ts)
// happen to share field names 1:1 with the frontend's LandingPage/LandingSectionAdmin types, so
// no field-renaming adapter is needed here (unlike Offer's expiresAt/endsAt mismatch).

export async function getLanding(offerId: string): Promise<LandingPage | null> {
  try {
    return await apiRequest<LandingPage>(`/admin/offers/${offerId}/landing`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function createLanding(offerId: string, input: CreateLandingInput): Promise<LandingPage> {
  return apiRequest<LandingPage>(`/admin/offers/${offerId}/landing`, { method: "POST", body: input });
}

export async function updateLanding(offerId: string, patch: Partial<LandingPage>): Promise<LandingPage> {
  return apiRequest<LandingPage>(`/admin/offers/${offerId}/landing`, { method: "PATCH", body: patch });
}

export async function publishLanding(offerId: string): Promise<LandingPage> {
  return apiRequest<LandingPage>(`/admin/offers/${offerId}/landing/publish`, { method: "POST" });
}

export async function unpublishLanding(offerId: string): Promise<LandingPage> {
  return apiRequest<LandingPage>(`/admin/offers/${offerId}/landing/unpublish`, { method: "POST" });
}

export async function archiveLanding(offerId: string): Promise<LandingPage> {
  return apiRequest<LandingPage>(`/admin/offers/${offerId}/landing/archive`, { method: "POST" });
}

interface PublicLandingPayload {
  offer: Offer;
  productType: string;
  landing: { template: string; seoTitle?: string; seoDescription?: string; seoKeywords: string[]; ogImageUrl?: string };
  sections: LandingSectionAdmin[];
}

// Admin-authenticated preview of the rendered public shape — works regardless of publish status
// (see LandingsController.preview / "Preview mode" in PROJECT_STATUS.md).
export async function previewLanding(offerId: string): Promise<PublicLandingPayload> {
  return apiRequest<PublicLandingPayload>(`/admin/offers/${offerId}/landing/preview`);
}

export async function getLandingSections(offerId: string): Promise<LandingSectionAdmin[]> {
  return apiRequest<LandingSectionAdmin[]>(`/admin/offers/${offerId}/landing-sections`);
}

export async function addLandingSection(offerId: string, type: LandingSectionType): Promise<LandingSectionAdmin> {
  return apiRequest<LandingSectionAdmin>(`/admin/offers/${offerId}/landing-sections`, { method: "POST", body: { type } });
}

export async function updateLandingSection(
  id: string,
  patch: Partial<Pick<LandingSectionAdmin, "content" | "isActive">>,
): Promise<LandingSectionAdmin> {
  return apiRequest<LandingSectionAdmin>(`/admin/landing-sections/${id}`, { method: "PATCH", body: patch });
}

// Unlike mock mode (which keeps a central in-memory store it can look up `id` against directly),
// the real API has no "get one section" endpoint — the caller already has the section's current
// `isActive` from its query cache, so it's passed through rather than re-fetched.
export async function toggleLandingSection(id: string, nextIsActive: boolean): Promise<LandingSectionAdmin> {
  return updateLandingSection(id, { isActive: nextIsActive });
}

export async function removeLandingSection(id: string): Promise<void> {
  await apiRequest<void>(`/admin/landing-sections/${id}`, { method: "DELETE" });
}

export async function reorderLandingSections(offerId: string, orderedIds: string[]): Promise<LandingSectionAdmin[]> {
  return apiRequest<LandingSectionAdmin[]>(`/admin/offers/${offerId}/landing-sections/reorder`, {
    method: "POST",
    body: { orderedIds },
  });
}

// ---- Campaigns ----

interface BackendCampaignOffer {
  id: string;
  name: string;
  slug: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  status: string;
}

interface BackendCampaignProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: string;
  type: string;
}

// Shape returned by CampaignsService.toAdminResponse() (apps/api/src/campaigns/campaigns.service.ts).
interface BackendCampaign {
  id: string;
  offerId: string;
  name: string;
  internalName: string | null;
  slug: string;
  description: string | null;
  internalNotes: string | null;
  category: string;
  ctaLabel: string;
  goal: string | null;
  targetAudience: string | null;
  platforms: string[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  requiredContentCount: number | null;
  contentDeadline: string | null;
  startDate: string | null;
  endDate: string | null;
  applicationStartDate: string | null;
  applicationDeadline: string | null;
  creatorLimit: number | null;
  requiresApproval: boolean;
  commissionType: Campaign["commissionType"];
  commissionRateBps: number | null;
  commissionAmountMinor: number | null;
  commissionCurrency: string;
  customerDiscountType: Campaign["customerDiscountType"];
  customerDiscountValue: number | null;
  barterEnabled: boolean;
  freeProduct: string | null;
  attributionWindowDays: number;
  status: Campaign["status"];
  archivedAt: string | null;
  availability: Campaign["availability"];
  applicationAvailability: Campaign["applicationAvailability"];
  approvedCreatorCount: number;
  commissionSource: "CAMPAIGN";
  offer: BackendCampaignOffer;
  product: BackendCampaignProduct;
  landingAvailability: Campaign["landingAvailability"];
  media: BackendCampaignMedia[];
}

interface BackendCampaignMedia {
  id: string;
  mediaType: string;
  mediaRole: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  sortOrder: number;
}

function mapBackendCampaignMedia(m: BackendCampaignMedia): CampaignMediaItem {
  return {
    id: m.id,
    mediaType: m.mediaType as CampaignMediaType,
    mediaRole: m.mediaRole as CampaignMediaRole,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    durationSeconds: m.durationSeconds ?? undefined,
    altText: m.altText ?? undefined,
    sortOrder: m.sortOrder,
  };
}

function mapBackendCampaign(c: BackendCampaign): Campaign {
  return {
    id: c.id,
    offerId: c.offerId,
    name: c.name,
    internalName: c.internalName ?? undefined,
    slug: c.slug,
    description: c.description ?? "",
    internalNotes: c.internalNotes ?? undefined,
    category: c.category,
    ctaLabel: c.ctaLabel,
    goal: c.goal ?? "",
    targetAudience: c.targetAudience ?? "",
    platforms: c.platforms as Campaign["platforms"],
    contentFormats: c.contentFormats,
    requiredElements: c.requiredElements,
    forbiddenElements: c.forbiddenElements,
    referenceContent: c.referenceContent,
    minFollowers: c.minFollowers ?? undefined,
    maxFollowers: c.maxFollowers ?? undefined,
    requiredContentCount: c.requiredContentCount ?? undefined,
    contentDeadline: c.contentDeadline ?? undefined,
    startDate: c.startDate ?? undefined,
    endDate: c.endDate ?? undefined,
    applicationStartDate: c.applicationStartDate ?? undefined,
    applicationDeadline: c.applicationDeadline ?? "",
    creatorLimit: c.creatorLimit ?? 0,
    requiresApproval: c.requiresApproval,
    commissionType: c.commissionType,
    commissionRateBps: c.commissionRateBps ?? undefined,
    commissionAmountMinor: c.commissionAmountMinor ?? undefined,
    commissionCurrency: c.commissionCurrency,
    media: c.media.map(mapBackendCampaignMedia),
    customerDiscountType: c.customerDiscountType ?? undefined,
    customerDiscountValue: c.customerDiscountValue ?? undefined,
    barterEnabled: c.barterEnabled,
    freeProduct: c.freeProduct ?? undefined,
    attributionWindowDays: c.attributionWindowDays,
    status: c.status,
    archivedAt: c.archivedAt ?? undefined,
    availability: c.availability,
    applicationAvailability: c.applicationAvailability,
    approvedCreatorCount: c.approvedCreatorCount,
    commissionSource: c.commissionSource,
    landingAvailability: c.landingAvailability,
    offer: {
      id: c.offer.id,
      name: c.offer.name,
      slug: c.offer.slug,
      productType: c.product.type as Campaign["offer"]["productType"],
      priceMinor: c.offer.priceMinor,
      compareAtPriceMinor: c.offer.compareAtPriceMinor ?? undefined,
      currency: c.offer.currency,
    },
  };
}

// Server-only/computed/immutable fields that must never travel back in a create/update body —
// the backend's DTOs are whitelist-validated (forbidNonWhitelisted), so an unknown property is a
// hard 400, not a silently-ignored extra. `assets` is mock-only (no real CampaignAsset write API
// yet); `offerId` is create-only (immutable after creation, stripped from updates below).
const CAMPAIGN_SERVER_ONLY_FIELDS = [
  "id",
  "assets",
  "offer",
  "product",
  "coverImage",
  "status",
  "archivedAt",
  "availability",
  "applicationAvailability",
  "approvedCreatorCount",
  "commissionSource",
  "landingAvailability",
] as const;

function mapCampaignInputToBackend(input: Record<string, unknown>, opts: { stripOfferId: boolean }): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const field of CAMPAIGN_SERVER_ONLY_FIELDS) delete out[field];
  if (opts.stripOfferId) delete out.offerId;
  return out;
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await apiRequest<PaginatedResponse<BackendCampaign>>("/admin/campaigns");
  return res.items.map(mapBackendCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    return mapBackendCampaign(await apiRequest<BackendCampaign>(`/admin/campaigns/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return mapBackendCampaign(
    await apiRequest<BackendCampaign>("/admin/campaigns", {
      method: "POST",
      body: mapCampaignInputToBackend(input as unknown as Record<string, unknown>, { stripOfferId: false }),
    }),
  );
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign> {
  return mapBackendCampaign(
    await apiRequest<BackendCampaign>(`/admin/campaigns/${id}`, {
      method: "PATCH",
      body: mapCampaignInputToBackend(patch as Record<string, unknown>, { stripOfferId: true }),
    }),
  );
}

export async function activateCampaign(id: string): Promise<Campaign> {
  return mapBackendCampaign(await apiRequest<BackendCampaign>(`/admin/campaigns/${id}/activate`, { method: "POST" }));
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  return mapBackendCampaign(await apiRequest<BackendCampaign>(`/admin/campaigns/${id}/pause`, { method: "POST" }));
}

export async function completeCampaign(id: string): Promise<Campaign> {
  return mapBackendCampaign(await apiRequest<BackendCampaign>(`/admin/campaigns/${id}/complete`, { method: "POST" }));
}

export async function archiveCampaign(id: string): Promise<Campaign> {
  return mapBackendCampaign(await apiRequest<BackendCampaign>(`/admin/campaigns/${id}/archive`, { method: "POST" }));
}

// ---- Campaign applications (Creator Application domain review) ----

export interface CampaignApplicationListQuery {
  page?: number;
  pageSize?: number;
  status?: CampaignApplicationAdminView["status"];
  campaignId?: string;
  search?: string;
}

interface BackendAdminApplication {
  id: string;
  campaignId: string;
  creatorId: string;
  status: CampaignApplicationAdminView["status"];
  message: string | null;
  platform: CampaignApplicationAdminView["platform"] | null;
  contentFormat: string | null;
  portfolioLinks: string[];
  sampleContentLinks: string[];
  answers: Record<string, unknown> | null;
  followerSnapshot: number | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; displayName: string; city: string | null };
  campaign: { id: string; name: string; slug: string; category: string };
}

function mapAdminApplication(a: BackendAdminApplication): CampaignApplicationAdminView {
  return {
    id: a.id,
    campaignId: a.campaignId,
    status: a.status,
    message: a.message ?? undefined,
    platform: a.platform ?? undefined,
    contentFormat: a.contentFormat ?? undefined,
    portfolioLinks: a.portfolioLinks,
    sampleContentLinks: a.sampleContentLinks,
    answers: a.answers ?? undefined,
    followerSnapshot: a.followerSnapshot ?? undefined,
    adminNotes: a.adminNotes ?? undefined,
    rejectionReason: a.rejectionReason ?? undefined,
    changesRequestedReason: a.changesRequestedReason ?? undefined,
    submittedAt: a.submittedAt ?? undefined,
    reviewedAt: a.reviewedAt ?? undefined,
    approvedAt: a.approvedAt ?? undefined,
    rejectedAt: a.rejectedAt ?? undefined,
    withdrawnAt: a.withdrawnAt ?? undefined,
    reviewedById: a.reviewedById ?? undefined,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    creator: { id: a.creator.id, displayName: a.creator.displayName, city: a.creator.city ?? undefined },
    campaign: a.campaign,
  };
}

export async function getCampaignApplicationList(
  query: CampaignApplicationListQuery = {},
): Promise<{ items: CampaignApplicationAdminView[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.campaignId) params.set("campaignId", query.campaignId);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  const res = await apiRequest<PaginatedResponse<BackendAdminApplication>>(`/admin/creator-applications${qs ? `?${qs}` : ""}`);
  return { ...res, items: res.items.map(mapAdminApplication) };
}

export async function getCampaignApplication(id: string): Promise<CampaignApplicationAdminView | null> {
  try {
    return mapAdminApplication(await apiRequest<BackendAdminApplication>(`/admin/creator-applications/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function startReviewCampaignApplication(id: string): Promise<CampaignApplicationAdminView> {
  return mapAdminApplication(await apiRequest<BackendAdminApplication>(`/admin/creator-applications/${id}/start-review`, { method: "POST" }));
}

export async function approveCampaignApplicationReview(id: string): Promise<CampaignApplicationAdminView> {
  return mapAdminApplication(await apiRequest<BackendAdminApplication>(`/admin/creator-applications/${id}/approve`, { method: "POST" }));
}

export async function rejectCampaignApplicationReview(id: string, reason: string): Promise<CampaignApplicationAdminView> {
  return mapAdminApplication(
    await apiRequest<BackendAdminApplication>(`/admin/creator-applications/${id}/reject`, { method: "POST", body: { reason } }),
  );
}

export async function requestChangesCampaignApplication(id: string, reason: string): Promise<CampaignApplicationAdminView> {
  return mapAdminApplication(
    await apiRequest<BackendAdminApplication>(`/admin/creator-applications/${id}/request-changes`, { method: "POST", body: { reason } }),
  );
}

// ---- Campaign media (6B Enhancement) ----

export interface UploadMediaInput {
  file: File;
  mediaRole: "COVER" | "GALLERY" | "PROMOTIONAL";
  altText?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

function mediaFormData(input: UploadMediaInput): FormData {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("mediaRole", input.mediaRole);
  if (input.altText) fd.append("altText", input.altText);
  if (input.width != null) fd.append("width", String(input.width));
  if (input.height != null) fd.append("height", String(input.height));
  if (input.durationSeconds != null) fd.append("durationSeconds", String(input.durationSeconds));
  return fd;
}

export async function getCampaignMedia(campaignId: string): Promise<CampaignMediaItem[]> {
  const items = await apiRequest<BackendCampaignMedia[]>(`/admin/campaigns/${campaignId}/media`);
  return items.map(mapBackendCampaignMedia);
}

export async function uploadCampaignMedia(campaignId: string, input: UploadMediaInput): Promise<CampaignMediaItem> {
  return mapBackendCampaignMedia(
    await apiRequest<BackendCampaignMedia>(`/admin/campaigns/${campaignId}/media`, { method: "POST", body: mediaFormData(input) }),
  );
}

export async function replaceCampaignCover(campaignId: string, input: UploadMediaInput): Promise<CampaignMediaItem> {
  return mapBackendCampaignMedia(
    await apiRequest<BackendCampaignMedia>(`/admin/campaigns/${campaignId}/media/cover`, { method: "POST", body: mediaFormData(input) }),
  );
}

export async function setCampaignMediaCover(mediaId: string): Promise<CampaignMediaItem> {
  return mapBackendCampaignMedia(await apiRequest<BackendCampaignMedia>(`/admin/campaign-media/${mediaId}/set-cover`, { method: "PATCH" }));
}

export async function reorderCampaignMedia(campaignId: string, orderedIds: string[]): Promise<CampaignMediaItem[]> {
  const items = await apiRequest<BackendCampaignMedia[]>(`/admin/campaigns/${campaignId}/media/reorder`, { method: "POST", body: { orderedIds } });
  return items.map(mapBackendCampaignMedia);
}

export async function updateCampaignMediaAltText(mediaId: string, altText: string): Promise<CampaignMediaItem> {
  return mapBackendCampaignMedia(await apiRequest<BackendCampaignMedia>(`/admin/campaign-media/${mediaId}`, { method: "PATCH", body: { altText } }));
}

export async function deleteCampaignMedia(mediaId: string): Promise<void> {
  await apiRequest(`/admin/campaign-media/${mediaId}`, { method: "DELETE" });
}

// ---- Offer delivery regions (6B Enhancement) ----

export interface DeliveryRegionAdminItem {
  id: string;
  offerId: string;
  countryCode: string;
  regionCode: string;
  regionName: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
  feeType: "FREE" | "FIXED";
  deliveryFeeMinor: number;
  currency: string;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  active: boolean;
  sortOrder: number;
}

export interface DeliveryRegionInput {
  countryCode?: string;
  regionCode: string;
  regionName: string;
  availability?: "AVAILABLE" | "UNAVAILABLE";
  feeType: "FREE" | "FIXED";
  deliveryFeeMinor?: number;
  currency?: string;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
  active?: boolean;
}

export async function getDeliveryRegions(offerId: string): Promise<DeliveryRegionAdminItem[]> {
  return apiRequest<DeliveryRegionAdminItem[]>(`/admin/offers/${offerId}/delivery-regions`);
}

export async function createDeliveryRegion(offerId: string, input: DeliveryRegionInput): Promise<DeliveryRegionAdminItem> {
  return apiRequest<DeliveryRegionAdminItem>(`/admin/offers/${offerId}/delivery-regions`, { method: "POST", body: input });
}

export async function updateDeliveryRegion(id: string, input: Partial<DeliveryRegionInput>): Promise<DeliveryRegionAdminItem> {
  return apiRequest<DeliveryRegionAdminItem>(`/admin/delivery-regions/${id}`, { method: "PATCH", body: input });
}

export async function deleteDeliveryRegion(id: string): Promise<void> {
  await apiRequest(`/admin/delivery-regions/${id}`, { method: "DELETE" });
}

// ---- Creator-to-creator referral program (6B Enhancement) ----

export type ReferralActivityClass =
  | "NEW"
  | "ONBOARDING_STALLED"
  | "AWAITING_APPROVAL"
  | "APPROVED_INACTIVE"
  | "ACTIVE_NO_EARNINGS"
  | "EARNING"
  | "DORMANT";

export interface AdminReferralReward {
  id: string;
  referralId: string;
  referredDisplayName: string;
  ruleName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  qualifiedEarningsMinor: number | null;
  calculatedRewardMinor: number;
  currency: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminReferralItem {
  id: string;
  referrer: { id: string; displayName: string };
  referred: { id: string; displayName: string };
  referralCodeUsed: string;
  attributedAt: string;
  registeredAt: string;
  activity: ReferralActivityClass;
  lastMeaningfulActivityAt: string;
  qualifiedAt: string | null;
  disqualifiedAt: string | null;
  disqualificationReason: string | null;
  campaignApplicationCount: number;
  approvedCampaignApplicationCount: number;
  rewards: AdminReferralReward[];
}

export interface AdminReferralQuery {
  page?: number;
  pageSize?: number;
  referrerCreatorId?: string;
  referredCreatorId?: string;
  activity?: ReferralActivityClass;
  search?: string;
}

export async function getAdminReferrals(
  query: AdminReferralQuery = {},
): Promise<{ items: AdminReferralItem[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.referrerCreatorId) params.set("referrerCreatorId", query.referrerCreatorId);
  if (query.referredCreatorId) params.set("referredCreatorId", query.referredCreatorId);
  if (query.activity) params.set("activity", query.activity);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/creator-referrals${qs ? `?${qs}` : ""}`);
}

export async function getAdminReferral(id: string): Promise<AdminReferralItem> {
  return apiRequest<AdminReferralItem>(`/admin/creator-referrals/${id}`);
}

export async function disqualifyReferral(id: string, reason: string): Promise<AdminReferralItem> {
  return apiRequest<AdminReferralItem>(`/admin/creator-referrals/${id}/disqualify`, { method: "POST", body: { reason } });
}

export interface ReferralRule {
  id: string;
  name: string;
  rewardType: "MILESTONE_FIXED" | "EARNINGS_PERCENTAGE";
  milestoneType: string | null;
  fixedRewardMinor: number | null;
  rewardRateBps: number | null;
  currency: string;
  qualifyingEarningsThresholdMinor: number | null;
  earningWindowDays: number | null;
  maximumRewardPerReferralMinor: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralRuleInput {
  name: string;
  rewardType: "MILESTONE_FIXED" | "EARNINGS_PERCENTAGE";
  milestoneType?: string;
  fixedRewardMinor?: number;
  rewardRateBps?: number;
  currency?: string;
  qualifyingEarningsThresholdMinor?: number;
  earningWindowDays?: number;
  maximumRewardPerReferralMinor?: number;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
}

export async function getReferralRules(): Promise<ReferralRule[]> {
  return apiRequest<ReferralRule[]>("/admin/referral-rules");
}

export async function createReferralRule(input: ReferralRuleInput): Promise<ReferralRule> {
  return apiRequest<ReferralRule>("/admin/referral-rules", { method: "POST", body: input });
}

export async function updateReferralRule(id: string, input: Partial<ReferralRuleInput>): Promise<ReferralRule> {
  return apiRequest<ReferralRule>(`/admin/referral-rules/${id}`, { method: "POST", body: input });
}

export async function activateReferralRule(id: string): Promise<ReferralRule> {
  return apiRequest<ReferralRule>(`/admin/referral-rules/${id}/activate`, { method: "POST" });
}

export async function deactivateReferralRule(id: string): Promise<ReferralRule> {
  return apiRequest<ReferralRule>(`/admin/referral-rules/${id}/deactivate`, { method: "POST" });
}

export async function approveReferralReward(id: string): Promise<AdminReferralReward> {
  return apiRequest<AdminReferralReward>(`/admin/creator-referral-rewards/${id}/approve`, { method: "POST" });
}

export async function rejectReferralReward(id: string, reason: string): Promise<AdminReferralReward> {
  return apiRequest<AdminReferralReward>(`/admin/creator-referral-rewards/${id}/reject`, { method: "POST", body: { reason } });
}

// ---- Content review (Phase 7A) — real backend only; distinct from the legacy mock-only
// CreatorContent moderation flow (apps/web/src/mocks/store.ts's apiAdminGetAllContent etc.),
// which stays untouched under the old getAllContent/approveContent/... export names. ----

interface BackendContentAttachmentAdmin {
  id: string;
  attachmentType: string;
  role: string;
  publicUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sortOrder: number;
}

interface BackendContentVersionAdmin {
  id: string;
  versionNumber: number;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: unknown;
  submittedAt: string;
}

interface BackendContentCommentAdmin {
  id: string;
  versionNumber: number;
  action: string;
  comment: string;
  createdAt: string;
  authorId: string;
}

interface BackendContentAdmin {
  id: string;
  campaignId: string;
  campaignApplicationId: string;
  status: string;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: unknown;
  currentVersionNumber: number;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: { id: string; name: string; slug: string; category: string; contentDeadline: string | null; requiredContentCount: number | null };
  creator: { id: string; displayName: string; city: string | null };
  attachments: BackendContentAttachmentAdmin[];
  versions: BackendContentVersionAdmin[];
  comments: BackendContentCommentAdmin[];
}

function mapAdminContentAttachment(a: BackendContentAttachmentAdmin): ContentAttachmentItem {
  return {
    id: a.id,
    attachmentType: a.attachmentType as ContentAttachmentType,
    role: a.role as ContentAttachmentItem["role"],
    url: a.publicUrl,
    thumbnailUrl: a.thumbnailUrl ?? undefined,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    durationSeconds: a.durationSeconds ?? undefined,
    sortOrder: a.sortOrder,
  };
}

function mapAdminContentComment(c: BackendContentCommentAdmin): ContentCommentItem {
  return { id: c.id, versionNumber: c.versionNumber, action: c.action as ContentReviewAction, comment: c.comment, createdAt: c.createdAt, authorId: c.authorId };
}

function mapAdminContent(c: BackendContentAdmin): ContentAdminView {
  return {
    id: c.id,
    campaignId: c.campaignId,
    campaignApplicationId: c.campaignApplicationId,
    status: c.status as ContentStatus,
    caption: c.caption ?? undefined,
    notes: c.notes ?? undefined,
    hashtags: c.hashtags,
    metadata: (c.metadata as Record<string, unknown> | null) ?? undefined,
    currentVersionNumber: c.currentVersionNumber,
    rejectionReason: c.rejectionReason ?? undefined,
    changesRequestedReason: c.changesRequestedReason ?? undefined,
    submittedAt: c.submittedAt ?? undefined,
    reviewedAt: c.reviewedAt ?? undefined,
    approvedAt: c.approvedAt ?? undefined,
    rejectedAt: c.rejectedAt ?? undefined,
    expiredAt: c.expiredAt ?? undefined,
    reviewedById: c.reviewedById ?? undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    campaign: {
      id: c.campaign.id,
      name: c.campaign.name,
      slug: c.campaign.slug,
      category: c.campaign.category,
      contentDeadline: c.campaign.contentDeadline ?? undefined,
      requiredContentCount: c.campaign.requiredContentCount ?? undefined,
    },
    creator: { id: c.creator.id, displayName: c.creator.displayName, city: c.creator.city ?? undefined },
    attachments: c.attachments.map(mapAdminContentAttachment),
    versions: c.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      caption: v.caption ?? undefined,
      notes: v.notes ?? undefined,
      hashtags: v.hashtags,
      metadata: (v.metadata as Record<string, unknown> | null) ?? undefined,
      submittedAt: v.submittedAt,
    })),
    comments: c.comments.map(mapAdminContentComment),
  };
}

export interface ContentListQuery {
  page?: number;
  pageSize?: number;
  status?: ContentStatus;
  campaignId?: string;
  creatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getContentList(query: ContentListQuery = {}): Promise<{ items: ContentAdminView[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.campaignId) params.set("campaignId", query.campaignId);
  if (query.creatorId) params.set("creatorId", query.creatorId);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  const qs = params.toString();
  const res = await apiRequest<PaginatedResponse<BackendContentAdmin>>(`/admin/contents${qs ? `?${qs}` : ""}`);
  return { ...res, items: res.items.map(mapAdminContent) };
}

export async function getContentDetail(id: string): Promise<ContentAdminView | null> {
  try {
    return mapAdminContent(await apiRequest<BackendContentAdmin>(`/admin/contents/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function startReviewContent(id: string): Promise<ContentAdminView> {
  return mapAdminContent(await apiRequest<BackendContentAdmin>(`/admin/contents/${id}/start-review`, { method: "POST" }));
}

export async function approveContentReview(id: string, comment?: string): Promise<ContentAdminView> {
  return mapAdminContent(await apiRequest<BackendContentAdmin>(`/admin/contents/${id}/approve`, { method: "POST", body: { comment } }));
}

export async function rejectContentReview(id: string, reason: string): Promise<ContentAdminView> {
  return mapAdminContent(await apiRequest<BackendContentAdmin>(`/admin/contents/${id}/reject`, { method: "POST", body: { reason } }));
}

export async function requestChangesContent(id: string, reason: string): Promise<ContentAdminView> {
  return mapAdminContent(await apiRequest<BackendContentAdmin>(`/admin/contents/${id}/request-changes`, { method: "POST", body: { reason } }));
}

// ---- Order management (Phase 8) — real backend only; distinct from the legacy mock-only
// order/payment/refund/commission moderation flow (apps/web/src/mocks/store.ts's
// apiAdminGetOrders etc.), which stays untouched under the old getOrders/getOrder/... export
// names. AdminOrdersController's response shape (apps/api/src/orders/orders.service.ts's
// toAdminResponse) matches RealAdminOrder field-for-field, so no Backend*/mapper adapter is
// needed here — unlike Offer/Campaign/Content above, which predate a field rename this phase
// didn't need to repeat. ----

export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  status?: RealAdminOrder["status"];
  campaignId?: string;
  creatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getOrderList(query: OrderListQuery = {}): Promise<{ items: RealAdminOrder[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.campaignId) params.set("campaignId", query.campaignId);
  if (query.creatorId) params.set("creatorId", query.creatorId);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  const qs = params.toString();
  return apiRequest(`/admin/orders${qs ? `?${qs}` : ""}`);
}

export async function getOrderDetail(id: string): Promise<RealAdminOrder | null> {
  try {
    return await apiRequest<RealAdminOrder>(`/admin/orders/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function updateOrderStatusReal(id: string, status: RealAdminOrder["status"], note?: string): Promise<RealAdminOrder> {
  return apiRequest<RealAdminOrder>(`/admin/orders/${id}/status`, { method: "PATCH", body: { status, note } });
}

export async function updateOrderNotesReal(id: string, notes: string): Promise<RealAdminOrder> {
  return apiRequest<RealAdminOrder>(`/admin/orders/${id}/notes`, { method: "PATCH", body: { notes } });
}

export async function createOrderRefund(id: string, amountMinor: number, reason: string): Promise<RealAdminOrder> {
  return apiRequest<RealAdminOrder>(`/admin/orders/${id}/refunds`, { method: "POST", body: { amountMinor, reason } });
}

export { ApiError };
