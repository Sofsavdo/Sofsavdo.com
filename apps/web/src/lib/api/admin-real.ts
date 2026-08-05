// Real-backend implementation of the admin API seam — same function names/signatures as
// mocks/store.ts's apiAdmin* functions, re-exported through lib/api/admin.ts behind
// NEXT_PUBLIC_API_MODE so services/*.ts and every component never change. Only the auth
// functions and the Product domain are wired for real here — every other admin function still
// throws (loudly, not silently falling back to mock behavior) until its own Phase 6B domain slice
// lands, per the vertical-slice migration order in PROJECT_STATUS.md.
import type {
  AdminPromoCode,
  AdminReferralLink,
  AdminRole,
  AdminUser,
  AdminVisitor,
  AnalyticsFilters,
  Campaign,
  CampaignApplicationAdminView,
  CampaignMediaItem,
  CampaignMediaRole,
  CampaignMediaType,
  CommissionStatus,
  ContentAdminView,
  ContentAttachmentItem,
  ContentAttachmentType,
  ContentCommentItem,
  ContentReviewAction,
  ContentStatus,
  CreatorApplicationStatus,
  LandingPage,
  LandingSectionAdmin,
  LandingSectionType,
  Offer,
  OnboardingApplicationAdminView,
  OnboardingAuditEntry,
  Product,
  ProductStatus,
  RealAdminCommission,
  RealAdminNotification,
  RealAdminOrder,
  RealAdminPayment,
  RealAdminPayout,
  RealAdminRefund,
  RealAuditLogEntry,
  RealCampaignAnalyticsDetail,
  RealCampaignAnalyticsListItem,
  RealCampaignHistoryItem,
  RealCreatorAdminDetail,
  RealCreatorAdminListItem,
  BioComplianceStatus,
  CreatorTier,
  RealCreatorAnalyticsDetail,
  RealCreatorAnalyticsListItem,
  RealCustomerAnalytics,
  RealEarningsSummary,
  RealExecutiveAnalytics,
  RealNotificationChannel,
  RealNotificationDeliveryStatus,
  RealPaginatedAnalytics,
  RealPaymentAnalytics,
  RealPayoutStatus,
  RealPayoutSummary,
  RealPaymentTimelineEntry,
  RealProductAnalyticsDetail,
  RealProductAnalyticsListItem,
  RealRefundAnalytics,
  RealRole,
  RealSettingItem,
  RealStaffUser,
  RealUserStatus,
  SettingCategory,
} from "@sofsavdo/types";
import type { ReferralSummary } from "./creator-real";
import { apiRequest, getAccessToken, setAccessToken, ApiError } from "./http-client";
import type { CreateCampaignInput, CreateLandingInput, CreateOfferInput } from "../../mocks/store";

interface BackendSessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  roleKeys: string[];
  permissions: string[];
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
  return { id: user.id, email: user.email ?? "", displayName, role, permissions: user.permissions };
}

// Phase 12 added real Roles CRUD, so a staff account can now hold only a custom role (neither
// super_admin/admin/manager). This coarse 3-tier mapping is display-only now (ROLE_LABELS, the dev
// role-switcher) — it used to also gate real UI visibility (RoleGuard's `min` prop, nav-items.ts's
// `minRole`), which was a real bug: any custom role, no matter what it was actually granted, fell
// back to the lowest tier and got silently locked out of pages it had real permission for. Fixed by
// switching all of that to check `AdminUser.permissions` (the real, effective permission-key set)
// directly instead of this tier — see DECISIONS.md's Roles/RBAC ADR.
function mapRoleKeysToAdminRole(roleKeys: string[]): AdminRole {
  if (roleKeys.includes("super_admin")) return "SUPER_ADMIN";
  if (roleKeys.includes("admin")) return "ADMIN";
  if (roleKeys.includes("manager")) return "MANAGER";
  if (roleKeys.length > 0) return "MANAGER";
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
  // pageSize=100 (the backend's max — see pagination.dto.ts) rather than the default 20: this
  // function's callers (e.g. the analytics product filter dropdown) expect the whole catalog,
  // not just its first page. A catalog bigger than 100 products would need real pagination here,
  // but that's not this platform's current scale.
  const res = await apiRequest<PaginatedResponse<Product>>("/admin/products?pageSize=100");
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
    // This admin CRUD endpoint doesn't return product images (only the landing preview/public
    // endpoint does, see public-real.ts) — never rendered through Hero/Gallery, so an empty array
    // is harmless here.
    images: [],
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

export async function addLandingSection(offerId: string, type: LandingSectionType, content?: Record<string, unknown>): Promise<LandingSectionAdmin> {
  return apiRequest<LandingSectionAdmin>(`/admin/offers/${offerId}/landing-sections`, { method: "POST", body: { type, content } });
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

// ---- Homepage CMS (Phase H) ----
// Flat, unlike Landing sections — no offerId path segment, since a homepage section has no parent
// (see DECISIONS.md ADR-027). Backend's HomepageSectionResponse happens to share field names 1:1
// with HomepageSectionAdmin below, same as Landing's own no-adapter-needed note above.

export type HomepageSectionType =
  | "HERO"
  | "WHY_SOFSAVDO"
  | "FEATURED_PRODUCTS"
  | "BANNER"
  | "CREATOR_PROGRAM_BLURB"
  | "BENEFITS"
  | "FAQ"
  | "SUPPORT"
  | "CUSTOM_RICH_TEXT"
  | "CATEGORY_GRID";

export interface HomepageSectionAdmin {
  id: string;
  type: HomepageSectionType;
  sortOrder: number;
  isActive: boolean;
  content: Record<string, unknown>;
  startsAt: string | null;
  expiresAt: string | null;
}

export async function getHomepageSectionsAdmin(): Promise<HomepageSectionAdmin[]> {
  return apiRequest<HomepageSectionAdmin[]>("/admin/homepage-sections");
}

export async function addHomepageSection(type: HomepageSectionType): Promise<HomepageSectionAdmin> {
  return apiRequest<HomepageSectionAdmin>("/admin/homepage-sections", { method: "POST", body: { type } });
}

export async function updateHomepageSection(
  id: string,
  patch: Partial<Pick<HomepageSectionAdmin, "content" | "isActive" | "startsAt" | "expiresAt">>,
): Promise<HomepageSectionAdmin> {
  return apiRequest<HomepageSectionAdmin>(`/admin/homepage-sections/${id}`, { method: "PATCH", body: patch });
}

export async function toggleHomepageSection(id: string, nextIsActive: boolean): Promise<HomepageSectionAdmin> {
  return updateHomepageSection(id, { isActive: nextIsActive });
}

export async function removeHomepageSection(id: string): Promise<void> {
  await apiRequest<void>(`/admin/homepage-sections/${id}`, { method: "DELETE" });
}

export async function reorderHomepageSections(orderedIds: string[]): Promise<HomepageSectionAdmin[]> {
  return apiRequest<HomepageSectionAdmin[]>("/admin/homepage-sections/reorder", { method: "POST", body: { orderedIds } });
}

// ---- AI Product Creation Engine (Phase I) ----
// Shape returned by ProductAiPort.generateDraft (apps/api/src/product-ai/product-ai.port.ts) —
// always a draft to review/edit, never auto-saved. See DECISIONS.md ADR-028.

export interface ProductAiDraft {
  title: string;
  shortDescription: string;
  description: string;
  features: string[];
  benefits: string[];
  specs: Record<string, string>;
  usageInstructions: string;
  ctaLabel: string;
  marketingCopy: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  faq: { question: string; answer: string }[];
  highlights: string[];
  tags: string[];
}

export interface GenerateProductDraftInput {
  imageUrls?: string[];
  productName?: string;
  shortDescription?: string;
}

export async function generateProductDraft(input: GenerateProductDraftInput): Promise<ProductAiDraft> {
  return apiRequest<ProductAiDraft>("/admin/product-ai/draft", { method: "POST", body: input });
}

// ---- Competitions (Phase L) — real backend only, no mock counterpart (brand-new surface). Field
// names match CompetitionResponse (apps/api/src/competitions/competitions.service.ts) 1:1.

export type CompetitionStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type CompetitionAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";

export interface CompetitionAdmin {
  id: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  status: CompetitionStatus;
  availability: CompetitionAvailability;
  metric: "ORDER_COUNT" | "REFERRAL_COUNT" | "INSTAGRAM_VIEWS";
  firstPrize: string;
  secondPrize: string;
  thirdPrize: string;
  imageUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompetitionInput {
  name: string;
  description?: string;
  startAt: string;
  endAt: string;
  metric: "ORDER_COUNT" | "REFERRAL_COUNT" | "INSTAGRAM_VIEWS";
  firstPrize: string;
  secondPrize: string;
  thirdPrize: string;
  imageUrl?: string;
}

export async function getCompetitions(): Promise<{ items: CompetitionAdmin[] }> {
  return apiRequest<{ items: CompetitionAdmin[] }>("/admin/competitions");
}

export async function getCompetition(id: string): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>(`/admin/competitions/${id}`);
}

export async function createCompetition(input: CreateCompetitionInput): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>("/admin/competitions", { method: "POST", body: input });
}

export async function updateCompetition(id: string, patch: Partial<CreateCompetitionInput>): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>(`/admin/competitions/${id}`, { method: "PATCH", body: patch });
}

export async function publishCompetition(id: string): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>(`/admin/competitions/${id}/publish`, { method: "POST" });
}

export async function completeCompetition(id: string): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>(`/admin/competitions/${id}/complete`, { method: "POST" });
}

export async function archiveCompetition(id: string): Promise<CompetitionAdmin> {
  return apiRequest<CompetitionAdmin>(`/admin/competitions/${id}/archive`, { method: "POST" });
}

// ---- Competition participants (video-submission review, metric === "INSTAGRAM_VIEWS") — field
// names match CompetitionParticipantAdminResponse 1:1.

export type CompetitionParticipantStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CompetitionParticipantAdmin {
  id: string;
  creatorId: string;
  creatorName: string;
  status: CompetitionParticipantStatus;
  videoUrl: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  viewCount: number;
  viewCountUpdatedAt: string | null;
  viewCountSource: string | null;
  joinedAt: string;
}

export async function getCompetitionParticipants(competitionId: string): Promise<CompetitionParticipantAdmin[]> {
  return apiRequest<CompetitionParticipantAdmin[]>(`/admin/competitions/${competitionId}/participants`);
}

export async function approveCompetitionParticipant(participantId: string): Promise<CompetitionParticipantAdmin> {
  return apiRequest<CompetitionParticipantAdmin>(`/admin/competitions/participants/${participantId}/approve`, { method: "POST" });
}

export async function rejectCompetitionParticipant(participantId: string, reason: string): Promise<CompetitionParticipantAdmin> {
  return apiRequest<CompetitionParticipantAdmin>(`/admin/competitions/participants/${participantId}/reject`, { method: "POST", body: { reason } });
}

export async function updateCompetitionParticipantViewCount(participantId: string, viewCount: number): Promise<CompetitionParticipantAdmin> {
  return apiRequest<CompetitionParticipantAdmin>(`/admin/competitions/participants/${participantId}/view-count`, { method: "PATCH", body: { viewCount } });
}

// Best-effort — see InstagramViewsScraperAdapter's own comment. Can fail (Instagram blocked the
// fetch, changed its page, etc.); the caller should fall back to updateCompetitionParticipantViewCount.
export async function refreshCompetitionParticipantViewCount(participantId: string): Promise<CompetitionParticipantAdmin> {
  return apiRequest<CompetitionParticipantAdmin>(`/admin/competitions/participants/${participantId}/refresh-views`, { method: "POST" });
}

// ---- Admin executive dashboard (Phase M) — real backend only, replacing a previously 100%-
// mocked page with zero USE_REAL_API gating at all (see DECISIONS.md ADR-031). Field names match
// AdminDashboardResponse (apps/api/src/admin-dashboard/admin-dashboard.service.ts) 1:1.

export interface AdminDashboardFunnel {
  clicks: number;
  orders: number;
  paidOrders: number;
}

export interface AdminDashboardTask {
  text: string;
  href: string;
}

export interface AdminDashboardTopEntry {
  name: string;
  revenueMinor: number;
}

export interface AdminDashboardTrendPoint {
  day: string;
  ordersCount: number;
  revenueMinor: number;
}

export interface AdminDashboardResponse {
  todayRevenueMinor: number;
  monthlyRevenueMinor: number;
  netRevenueMinor: number;
  paidOrders: number;
  conversionRate: number;
  averageOrderValueMinor: number;
  refundRate: number;
  activeCampaignsCount: number;
  creatorRevenueMinor: number;
  directRevenueMinor: number;
  commissionLiabilityMinor: number;
  pendingPayoutsMinor: number;
  trend: AdminDashboardTrendPoint[];
  funnel: AdminDashboardFunnel;
  tasks: AdminDashboardTask[];
  topOffers: AdminDashboardTopEntry[];
  topCreators: AdminDashboardTopEntry[];
}

export async function getDashboard(): Promise<AdminDashboardResponse> {
  return apiRequest<AdminDashboardResponse>("/admin/dashboard");
}

// ---- Referral links / promo codes / visitors (Phase M) — real backend only, replacing bare mock
// re-exports with zero USE_REAL_API gating at all (see DECISIONS.md ADR-031). Reshaped at this
// boundary to the pre-existing shared AdminReferralLink/AdminPromoCode/AdminVisitor types
// (@sofsavdo/types) the pages already expect, same convention as every other admin-real.ts
// function in this file.

interface BackendAdminReferralLink {
  code: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  offerName: string;
  clicks: number;
  orders: number;
  revenueMinor: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED";
}

function mapReferralLink(l: BackendAdminReferralLink): AdminReferralLink {
  // fullUrl/createdAt are declared on the shared type but never actually rendered by the
  // referral-links page (confirmed by reading it) — left as harmless placeholders rather than
  // spending effort computing a real value nothing displays.
  return { ...l, fullUrl: "", createdAt: new Date().toISOString() };
}

export async function getReferralLinks(): Promise<AdminReferralLink[]> {
  const items = await apiRequest<BackendAdminReferralLink[]>("/admin/referral-links");
  return items.map(mapReferralLink);
}

export async function deactivateReferralLink(code: string): Promise<AdminReferralLink> {
  const updated = await apiRequest<Pick<BackendAdminReferralLink, "code" | "creatorName" | "campaignName" | "offerName" | "status">>(
    `/admin/referral-links/${code}/deactivate`,
    { method: "POST" },
  );
  return mapReferralLink({ ...updated, creatorId: "", campaignId: "", clicks: 0, orders: 0, revenueMinor: 0 });
}

interface BackendAdminPromoCode {
  code: string;
  creatorName: string;
  campaignName: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  usageCount: number;
  usageLimit: number | null;
  isActive: boolean;
}

export async function getPromoCodes(): Promise<AdminPromoCode[]> {
  const items = await apiRequest<BackendAdminPromoCode[]>("/admin/promo-codes");
  // creatorId/campaignId aren't in the real response (the page never uses them, only the names)
  // — left blank rather than fabricated.
  return items.map((p) => ({ ...p, creatorId: "", campaignId: "", usageLimit: p.usageLimit ?? undefined }));
}

interface BackendAdminVisitor {
  id: string;
  visitorId: string;
  offerName: string;
  campaignName: string | null;
  creatorName: string | null;
  source: "PROMO_CODE" | "REFERRAL_VISIT" | "MANUAL" | null;
  landingPage: string;
  createdAt: string;
  expiresAt: string;
  attributedOrderToken: string | null;
  fraudRiskFlags: string[];
}

export async function getVisitors(): Promise<AdminVisitor[]> {
  const items = await apiRequest<BackendAdminVisitor[]>("/admin/visitors");
  return items.map((v) => ({
    id: v.id,
    visitorId: v.visitorId,
    offerName: v.offerName,
    campaignName: v.campaignName ?? undefined,
    creatorName: v.creatorName ?? undefined,
    // The shared AdminVisitor type has no "not yet attributed"/"MANUAL" case — null (no
    // Attribution exists yet) maps to "DIRECT" (the closest fit: not tied to a tracked channel),
    // and the rare MANUAL (admin-corrected) case maps to "REFERRAL_VISIT".
    source: v.source === "PROMO_CODE" ? "PROMO_CODE" : v.source === null ? "DIRECT" : "REFERRAL_VISIT",
    landingPage: v.landingPage,
    createdAt: v.createdAt,
    expiresAt: v.expiresAt,
    attributedOrderToken: v.attributedOrderToken ?? undefined,
    fraudRiskFlags: v.fraudRiskFlags,
  }));
}

// No real backend implements manual attribution override yet (a genuine, pre-existing, already-
// disclosed gap — see PRODUCTION_READINESS.md's "Manual attribution override" line and
// DECISIONS.md ADR-031). Rejecting loudly here is deliberate: this touches real commission
// reassignment, so a Super Admin must never see a false "success" for an action that silently did
// nothing on the real backend.
export async function overrideAttribution(): Promise<never> {
  throw new ApiError("NOT_IMPLEMENTED", "Attribution'ni qo'lda o'zgartirish hali ishlab chiqilmagan.", 501);
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
  // Same pageSize=100 reasoning as getProducts() above — callers expect the full campaign list.
  const res = await apiRequest<PaginatedResponse<BackendCampaign>>("/admin/campaigns?pageSize=100");
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

// A plain image-upload endpoint — not part of the CampaignMedia domain above (Product.images is
// just a `string[]` of URLs, not a dedicated media model with cover/gallery roles), used by
// ProductForm's image field so an admin uploads a real file instead of pasting an external URL.
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const { url } = await apiRequest<{ url: string }>("/admin/uploads/image", { method: "POST", body: fd });
  return url;
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

export async function seedStandardDeliveryRegions(offerId: string): Promise<DeliveryRegionAdminItem[]> {
  return apiRequest<DeliveryRegionAdminItem[]>(`/admin/offers/${offerId}/delivery-regions/seed-standard`, { method: "POST" });
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
  postUrl: string | null;
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
  postUrl: string | null;
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
    postUrl: c.postUrl ?? undefined,
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
      postUrl: v.postUrl ?? undefined,
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

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only, same
// no-mock-counterpart precedent as Order management above. Renamed at this boundary
// (getCommissionSettlementList/approveCommission/...) to avoid colliding with the legacy
// mock-only getCommissions/manualAdjustCommission/getPayouts/approvePayout/rejectPayout/
// markPayoutPaid re-exported further up in lib/api/admin.ts. Admin PAID is a manual confirmation
// only (locked constraint: no automatic bank/provider payouts), so unlike the mock's
// approve/markPayoutPaid, there is no referenceNumber field here. ----

export interface CommissionSettlementQuery {
  page?: number;
  pageSize?: number;
  status?: CommissionStatus;
  creatorId?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getCommissionSettlementList(
  query: CommissionSettlementQuery = {},
): Promise<{ items: RealAdminCommission[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.creatorId) params.set("creatorId", query.creatorId);
  if (query.campaignId) params.set("campaignId", query.campaignId);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/commissions${qs ? `?${qs}` : ""}`);
}

export async function getCommissionSettlementDetail(id: string): Promise<RealAdminCommission> {
  return apiRequest<RealAdminCommission>(`/admin/commissions/${id}`);
}

export async function approveCommission(id: string): Promise<RealAdminCommission> {
  return apiRequest<RealAdminCommission>(`/admin/commissions/${id}/approve`, { method: "POST" });
}

export async function rejectCommission(id: string, reason: string): Promise<RealAdminCommission> {
  return apiRequest<RealAdminCommission>(`/admin/commissions/${id}/reject`, { method: "POST", body: { reason } });
}

export async function markCommissionPayable(id: string): Promise<RealAdminCommission> {
  return apiRequest<RealAdminCommission>(`/admin/commissions/${id}/mark-payable`, { method: "POST" });
}

export interface AdminPayoutQuery {
  page?: number;
  pageSize?: number;
  status?: RealPayoutStatus;
  creatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getAdminPayoutList(
  query: AdminPayoutQuery = {},
): Promise<{ items: RealAdminPayout[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.creatorId) params.set("creatorId", query.creatorId);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/payouts${qs ? `?${qs}` : ""}`);
}

export async function getAdminPayoutDetail(id: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}`);
}

export async function approveAdminPayout(id: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}/approve`, { method: "POST" });
}

export async function rejectAdminPayout(id: string, reason: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}/reject`, { method: "POST", body: { reason } });
}

export async function markAdminPayoutProcessing(id: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}/processing`, { method: "POST" });
}

export async function markAdminPayoutPaid(id: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}/paid`, { method: "POST" });
}

export async function markAdminPayoutFailed(id: string, reason: string): Promise<RealAdminPayout> {
  return apiRequest<RealAdminPayout>(`/admin/payouts/${id}/failed`, { method: "POST", body: { reason } });
}

// ---- Communication & Notification domain (Phase 10) — real backend only, no mock counterpart
// (see @sofsavdo/types' RealNotification comment). ----

export interface AdminNotificationQuery {
  page?: number;
  pageSize?: number;
  channel?: RealNotificationChannel;
  status?: RealNotificationDeliveryStatus;
  type?: string;
  userId?: string;
}

export async function getAdminNotificationList(
  query: AdminNotificationQuery = {},
): Promise<{ items: RealAdminNotification[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.channel) params.set("channel", query.channel);
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (query.userId) params.set("userId", query.userId);
  const qs = params.toString();
  return apiRequest(`/admin/notifications${qs ? `?${qs}` : ""}`);
}

export async function getAdminFailedNotificationList(
  query: Omit<AdminNotificationQuery, "status"> = {},
): Promise<{ items: RealAdminNotification[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.channel) params.set("channel", query.channel);
  if (query.type) params.set("type", query.type);
  if (query.userId) params.set("userId", query.userId);
  const qs = params.toString();
  return apiRequest(`/admin/notifications/failed${qs ? `?${qs}` : ""}`);
}

export async function retryAdminNotification(id: string): Promise<RealAdminNotification> {
  return apiRequest<RealAdminNotification>(`/admin/notifications/${id}/retry`, { method: "POST" });
}

// ---- Creator Onboarding & Admin Review domain (Phase 11) — real backend only, no mock
// counterpart of this shape (mock's admin review works off the plain CreatorUser list — see
// services/admin/creators.ts). Distinct route (admin/creator-onboarding) and distinct RBAC keys
// (onboarding.*) from admin/creator-applications (CampaignApplication review, ADR-012) — see
// DECISIONS.md ADR-018.

export interface OnboardingQuery {
  page?: number;
  pageSize?: number;
  status?: CreatorApplicationStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getOnboardingApplicationList(
  query: OnboardingQuery = {},
): Promise<{ items: OnboardingApplicationAdminView[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  const qs = params.toString();
  return apiRequest(`/admin/creator-onboarding${qs ? `?${qs}` : ""}`);
}

export async function getOnboardingApplicationDetail(id: string): Promise<OnboardingApplicationAdminView | null> {
  try {
    return await apiRequest<OnboardingApplicationAdminView>(`/admin/creator-onboarding/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function getOnboardingAuditTrail(id: string): Promise<OnboardingAuditEntry[]> {
  return apiRequest<OnboardingAuditEntry[]>(`/admin/creator-onboarding/${id}/audit`);
}

export async function startReviewOnboardingApplication(id: string): Promise<OnboardingApplicationAdminView> {
  return apiRequest<OnboardingApplicationAdminView>(`/admin/creator-onboarding/${id}/start-review`, { method: "POST" });
}

export async function approveOnboardingApplication(id: string): Promise<OnboardingApplicationAdminView> {
  return apiRequest<OnboardingApplicationAdminView>(`/admin/creator-onboarding/${id}/approve`, { method: "POST" });
}

export async function rejectOnboardingApplication(id: string, reason: string): Promise<OnboardingApplicationAdminView> {
  return apiRequest<OnboardingApplicationAdminView>(`/admin/creator-onboarding/${id}/reject`, { method: "POST", body: { reason } });
}

export async function requestChangesOnboardingApplication(id: string, reason: string): Promise<OnboardingApplicationAdminView> {
  return apiRequest<OnboardingApplicationAdminView>(`/admin/creator-onboarding/${id}/request-changes`, { method: "POST", body: { reason } });
}

// ---- Admin Operations domain (Phase 12) — real backend only, no mock counterpart. Every
// function below is a thin, direct pass-through to its endpoint (the backend's response shapes
// already match the Real* types field-for-field — no Backend*/mapper adapter needed, same as
// Order management in Phase 8). See DECISIONS.md ADR-019. ----

// -- Users (staff) --

export interface UserQuery {
  page?: number;
  pageSize?: number;
  status?: RealUserStatus;
  roleKey?: string;
  search?: string;
}

export async function getStaffUserList(query: UserQuery = {}): Promise<{ items: RealStaffUser[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.roleKey) params.set("roleKey", query.roleKey);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getStaffUserDetail(id: string): Promise<RealStaffUser | null> {
  try {
    return await apiRequest<RealStaffUser>(`/admin/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export interface CreateStaffUserInput {
  email?: string;
  phone?: string;
  password: string;
  displayName: string;
  roleIds: string[];
}

export async function createStaffUser(input: CreateStaffUserInput): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>("/admin/users", { method: "POST", body: input });
}

export async function updateStaffUser(id: string, input: Partial<Pick<CreateStaffUserInput, "displayName" | "email" | "phone">>): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>(`/admin/users/${id}`, { method: "PATCH", body: input });
}

export async function activateStaffUser(id: string): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>(`/admin/users/${id}/activate`, { method: "POST" });
}

export async function deactivateStaffUser(id: string): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>(`/admin/users/${id}/deactivate`, { method: "POST" });
}

export async function resetStaffUserPassword(id: string, newPassword: string): Promise<void> {
  await apiRequest(`/admin/users/${id}/reset-password`, { method: "POST", body: { newPassword } });
}

export async function assignStaffUserRole(id: string, roleId: string): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>(`/admin/users/${id}/roles`, { method: "POST", body: { roleId } });
}

export async function removeStaffUserRole(id: string, roleId: string): Promise<RealStaffUser> {
  return apiRequest<RealStaffUser>(`/admin/users/${id}/roles/${roleId}`, { method: "DELETE" });
}

// -- Roles & Permissions --

export async function getRealRoleList(): Promise<RealRole[]> {
  return apiRequest<RealRole[]>("/admin/roles");
}

export async function getRealRoleDetail(id: string): Promise<RealRole | null> {
  try {
    return await apiRequest<RealRole>(`/admin/roles/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function getAllPermissionKeys(): Promise<string[]> {
  return apiRequest<string[]>("/admin/permissions");
}

export async function createRealRole(input: { key: string; name: string; description?: string }): Promise<RealRole> {
  return apiRequest<RealRole>("/admin/roles", { method: "POST", body: input });
}

export async function updateRealRole(id: string, input: { name?: string; description?: string }): Promise<RealRole> {
  return apiRequest<RealRole>(`/admin/roles/${id}`, { method: "PATCH", body: input });
}

export async function assignRolePermission(id: string, permissionKey: string): Promise<RealRole> {
  return apiRequest<RealRole>(`/admin/roles/${id}/permissions`, { method: "POST", body: { permissionKey } });
}

export async function removeRolePermission(id: string, permissionKey: string): Promise<RealRole> {
  return apiRequest<RealRole>(`/admin/roles/${id}/permissions/${permissionKey}`, { method: "DELETE" });
}

// -- Creator administration --

export interface RealCreatorQuery {
  page?: number;
  pageSize?: number;
  onboardingStatus?: string;
  accountStatus?: RealUserStatus;
  search?: string;
}

export async function getRealCreatorList(
  query: RealCreatorQuery = {},
): Promise<{ items: RealCreatorAdminListItem[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.onboardingStatus) params.set("onboardingStatus", query.onboardingStatus);
  if (query.accountStatus) params.set("accountStatus", query.accountStatus);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/creators${qs ? `?${qs}` : ""}`);
}

export async function getRealCreatorDetail(id: string): Promise<RealCreatorAdminDetail | null> {
  try {
    return await apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function getRealCreatorCampaignHistory(id: string): Promise<RealCampaignHistoryItem[]> {
  return apiRequest<RealCampaignHistoryItem[]>(`/admin/creators/${id}/campaign-history`);
}

export async function getRealCreatorEarningsSummary(id: string): Promise<RealEarningsSummary> {
  return apiRequest<RealEarningsSummary>(`/admin/creators/${id}/earnings-summary`);
}

export async function getRealCreatorPayoutSummary(id: string): Promise<RealPayoutSummary> {
  return apiRequest<RealPayoutSummary>(`/admin/creators/${id}/payout-summary`);
}

export async function getRealCreatorReferralSummary(id: string): Promise<ReferralSummary> {
  return apiRequest<ReferralSummary>(`/admin/creators/${id}/referral-summary`);
}

export async function suspendRealCreator(id: string, reason: string): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/suspend`, { method: "POST", body: { reason } });
}

export async function unsuspendRealCreator(id: string): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/unsuspend`, { method: "POST" });
}

export async function blockRealCreator(id: string, reason: string): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/block`, { method: "POST", body: { reason } });
}

export async function unblockRealCreator(id: string): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/unblock`, { method: "POST" });
}

// Phase Q — a manual admin spot-check (no automated bio-scraping — see DECISIONS.md ADR-034), not
// an account-status transition, so this is a plain PATCH rather than the suspend/block-style
// POST + reason convention above.
export async function setCreatorBioCompliance(id: string, status: BioComplianceStatus): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/bio-compliance`, { method: "PATCH", body: { status } });
}

export async function setCreatorTier(id: string, tier: CreatorTier): Promise<RealCreatorAdminDetail> {
  return apiRequest<RealCreatorAdminDetail>(`/admin/creators/${id}/tier`, { method: "PATCH", body: { tier } });
}

// -- Payments (read-only) --

export interface RealPaymentQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  provider?: string;
  search?: string;
}

export async function getRealPaymentList(query: RealPaymentQuery = {}): Promise<{ items: RealAdminPayment[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.provider) params.set("provider", query.provider);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/payments${qs ? `?${qs}` : ""}`);
}

export async function getRealPaymentDetail(id: string): Promise<RealAdminPayment | null> {
  try {
    return await apiRequest<RealAdminPayment>(`/admin/payments/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function getRealPaymentTimeline(id: string): Promise<RealPaymentTimelineEntry[]> {
  return apiRequest<RealPaymentTimelineEntry[]>(`/admin/payments/${id}/timeline`);
}

// -- Refunds --

export interface RealRefundQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export async function getRealRefundList(query: RealRefundQuery = {}): Promise<{ items: RealAdminRefund[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/refunds${qs ? `?${qs}` : ""}`);
}

export async function getRealRefundDetail(id: string): Promise<RealAdminRefund | null> {
  try {
    return await apiRequest<RealAdminRefund>(`/admin/refunds/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function approveRealRefund(id: string): Promise<RealAdminRefund> {
  return apiRequest<RealAdminRefund>(`/admin/refunds/${id}/approve`, { method: "POST" });
}

export async function rejectRealRefund(id: string, reason: string): Promise<RealAdminRefund> {
  return apiRequest<RealAdminRefund>(`/admin/refunds/${id}/reject`, { method: "POST", body: { reason } });
}

// -- Settings --

export async function getRealSettings(): Promise<RealSettingItem[]> {
  return apiRequest<RealSettingItem[]>("/admin/settings");
}

export async function updateRealSettings(values: Record<string, string | number | boolean>): Promise<RealSettingItem[]> {
  return apiRequest<RealSettingItem[]>("/admin/settings", { method: "PATCH", body: { values } });
}

export type { SettingCategory };

// -- Telegram account linking (any authenticated user, not admin-role-gated) --

export interface TelegramLinkStatus {
  linked: boolean;
}

export interface TelegramLinkToken {
  deepLink: string;
  botUsername: string;
  expiresAt: string;
}

export async function getTelegramLinkStatus(): Promise<TelegramLinkStatus> {
  return apiRequest<TelegramLinkStatus>("/notifications/telegram/link");
}

export async function createTelegramLinkToken(): Promise<TelegramLinkToken> {
  return apiRequest<TelegramLinkToken>("/notifications/telegram/link-token", { method: "POST" });
}

export async function unlinkTelegram(): Promise<TelegramLinkStatus> {
  return apiRequest<TelegramLinkStatus>("/notifications/telegram/link", { method: "DELETE" });
}

// -- Audit log (general browser) --

export interface RealAuditQuery {
  page?: number;
  pageSize?: number;
  entityType?: string;
  actorId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getRealAuditLogList(query: RealAuditQuery = {}): Promise<{ items: RealAuditLogEntry[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.action) params.set("action", query.action);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest(`/admin/audit-log${qs ? `?${qs}` : ""}`);
}

export async function getRealAuditLogDetail(id: string): Promise<RealAuditLogEntry | null> {
  try {
    return await apiRequest<RealAuditLogEntry>(`/admin/audit-log/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

// -- Analytics & Business Intelligence (Phase 13) --

// Every analytics endpoint (§7 of ANALYTICS.md) shares this exact querystring contract — one
// builder, reused by every function below, instead of repeating a 14-field URLSearchParams block
// per view.
function buildAnalyticsQuery(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.compare) params.set("compare", filters.compare);
  if (filters.creatorId) params.set("creatorId", filters.creatorId);
  if (filters.campaignId) params.set("campaignId", filters.campaignId);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters.region) params.set("region", filters.region);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  return params.toString();
}

export async function getRealExecutiveAnalytics(filters: AnalyticsFilters): Promise<RealExecutiveAnalytics> {
  return apiRequest(`/admin/analytics/executive?${buildAnalyticsQuery(filters)}`);
}

export async function getRealCreatorAnalyticsList(filters: AnalyticsFilters): Promise<RealPaginatedAnalytics<RealCreatorAnalyticsListItem>> {
  return apiRequest(`/admin/analytics/creators?${buildAnalyticsQuery(filters)}`);
}

export async function getRealCreatorAnalyticsDetail(id: string, filters: AnalyticsFilters): Promise<RealCreatorAnalyticsDetail> {
  return apiRequest(`/admin/analytics/creators/${id}?${buildAnalyticsQuery(filters)}`);
}

export async function getRealCampaignAnalyticsList(filters: AnalyticsFilters): Promise<RealPaginatedAnalytics<RealCampaignAnalyticsListItem>> {
  return apiRequest(`/admin/analytics/campaigns?${buildAnalyticsQuery(filters)}`);
}

export async function getRealCampaignAnalyticsDetail(id: string, filters: AnalyticsFilters): Promise<RealCampaignAnalyticsDetail> {
  return apiRequest(`/admin/analytics/campaigns/${id}?${buildAnalyticsQuery(filters)}`);
}

export async function getRealProductAnalyticsList(filters: AnalyticsFilters): Promise<RealPaginatedAnalytics<RealProductAnalyticsListItem>> {
  return apiRequest(`/admin/analytics/products?${buildAnalyticsQuery(filters)}`);
}

export async function getRealProductAnalyticsDetail(id: string, filters: AnalyticsFilters): Promise<RealProductAnalyticsDetail> {
  return apiRequest(`/admin/analytics/products/${id}?${buildAnalyticsQuery(filters)}`);
}

export async function getRealPaymentAnalytics(filters: AnalyticsFilters): Promise<RealPaymentAnalytics> {
  return apiRequest(`/admin/analytics/payments?${buildAnalyticsQuery(filters)}`);
}

export async function getRealRefundAnalytics(filters: AnalyticsFilters): Promise<RealRefundAnalytics> {
  return apiRequest(`/admin/analytics/refunds?${buildAnalyticsQuery(filters)}`);
}

export async function getRealCustomerAnalytics(filters: AnalyticsFilters): Promise<RealCustomerAnalytics> {
  return apiRequest(`/admin/analytics/customers?${buildAnalyticsQuery(filters)}`);
}

// CSV only for v1 (approved scope) — Excel/PDF are deferred, see ANALYTICS.md §15. This endpoint
// responds with `text/csv`, not JSON, so it can't go through `apiRequest` (which always calls
// `res.json()`) — a small dedicated fetch instead, mirroring http-client.ts's auth-header
// convention. Returns the raw CSV text; the page turns it into a download the same way the old
// mock export already did (Blob + object URL), just with real data now.
export async function exportRealAnalyticsCsv(view: string, filters: AnalyticsFilters): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const qs = buildAnalyticsQuery(filters);
  const res = await fetch(`${apiUrl}/admin/analytics/export?view=${view}&format=csv&${qs}`, {
    credentials: "include",
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(json.code ?? "ERROR", json.message ?? "Eksport qilib bo'lmadi.", res.status);
  }
  return res.text();
}

// Launch Bonus System API functions
export async function getLaunchBonusSettings(): Promise<any> {
  return apiRequest("/launch-bonus/settings");
}

export async function updateLaunchBonusSettings(data: any): Promise<any> {
  return apiRequest("/launch-bonus/settings", { method: "PUT", body: data });
}

export async function getPendingBioVerifications(): Promise<any[]> {
  return apiRequest("/launch-bonus/pending-verifications");
}

export async function verifyBioLink(creatorProfileId: string, approved: boolean): Promise<void> {
  return apiRequest("/launch-bonus/verify-bio", { method: "POST", body: { creatorProfileId, approved } });
}

export async function checkBonuses(): Promise<void> {
  return apiRequest("/launch-bonus/check-bonuses", { method: "POST" });
}

export { ApiError };
