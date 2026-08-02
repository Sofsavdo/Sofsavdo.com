// Typed API client. Every function here matches one endpoint in API.md by name/shape.
// Most are still backed by src/mocks/store.ts (in-memory + localStorage, simulated latency,
// realistic error cases); each is swapped for a real `fetch` call against apps/api as its own
// Phase 6B domain slice lands — call sites in src/services/*.ts never change, because the *shape*
// (async in, typed out, can throw) is already what a real HTTP call would look like. Same
// NEXT_PUBLIC_API_MODE dispatch pattern as lib/api/admin.ts.
import type {
  Campaign,
  CampaignApplicationCreatorView,
  CreatorCampaign,
  CreatorUser,
  DeliveryRegionPublic,
  LandingSectionAdmin,
  Offer,
  OfferQuote,
  ProductType,
  ReferralContext,
} from "@sofsavdo/types";
import type { CheckoutOrderResult, CreateOrderInput, PromoValidationResult, Sale, TrackVisitResult } from "@sofsavdo/types";
import * as mockApi from "../../mocks/store";
import * as publicRealApi from "./public-real";
import * as creatorRealApi from "./creator-real";
import * as checkoutRealApi from "./checkout-real";
import type { OfferSeoMeta } from "./public-real";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

const EMPTY_SEO: OfferSeoMeta = { keywords: [] };

export const getOfferPublic = async (
  slug: string,
  refCode?: string,
): Promise<{ offer: Offer; productType: ProductType; deliveryRegions: DeliveryRegionPublic[]; sections: LandingSectionAdmin[]; seo: OfferSeoMeta; referral?: ReferralContext } | null> => {
  if (USE_REAL_API) return publicRealApi.getOfferPublic(slug, refCode);
  const result = await mockApi.apiGetOfferPublic(slug, refCode);
  return result ? { ...result, seo: EMPTY_SEO } : null;
};

export const getOfferQuote = (slug: string, regionCode?: string): Promise<OfferQuote> =>
  USE_REAL_API ? publicRealApi.getOfferQuote(slug, regionCode) : mockApi.apiGetOfferQuote(slug);

// Sofsavdo Commerce Home (Phase C) — real backend only, same convention as Content (Phase 7A)
// above: this is a brand-new public surface with no legacy mock behavior to preserve.
export type { FeaturedOffer } from "./public-real";
export { getFeaturedOffers } from "./public-real";

// Product/Offer Catalog (Phase E) — same convention: real backend only, brand-new public surface.
export type { CatalogOffer, CatalogQuery, PaginatedCatalog } from "./public-real";
export { getCatalog } from "./public-real";

// Homepage CMS (Phase H) — same convention: real backend only, brand-new public surface.
export type { HomepageSection } from "./public-real";
export { getHomepageSections } from "./public-real";

// Public homepage FOMO ticker — same convention: real backend only, brand-new public surface.
export type { PublicActivityEvent } from "./public-real";
export { getRecentActivity } from "./public-real";

export const getCampaigns = (): Promise<Campaign[]> => (USE_REAL_API ? creatorRealApi.getCampaigns() : mockApi.apiGetCampaigns());

export const getCampaign = (id: string): Promise<Campaign | null> =>
  USE_REAL_API ? creatorRealApi.getCampaign(id) : mockApi.apiGetCampaign(id);

export const login = (email: string, password: string): Promise<CreatorUser> =>
  USE_REAL_API ? creatorRealApi.login(email, password) : mockApi.apiLogin(email, password);

export const register = (email: string, fullName: string, password: string, referralCode?: string): Promise<CreatorUser> =>
  USE_REAL_API
    ? creatorRealApi.register(email, fullName, password, referralCode)
    : mockApi.apiRegister(email, fullName, password);

export const forgotPassword = (email: string): Promise<{ sent: boolean }> =>
  USE_REAL_API ? creatorRealApi.forgotPassword(email) : mockApi.apiForgotPassword(email);

export const logout = async (): Promise<void> => {
  if (USE_REAL_API) await creatorRealApi.logout();
  else mockApi.apiLogout();
};

export const getSession = (): Promise<CreatorUser | null> =>
  USE_REAL_API ? creatorRealApi.getSession() : mockApi.apiGetSession();

export const getMyCampaigns = (userId: string): Promise<CreatorCampaign[]> =>
  USE_REAL_API ? creatorRealApi.getMyCampaigns() : mockApi.apiGetMyCampaigns(userId);

// Real mode: creates the DRAFT application (with the form's pitch/platform/links) and submits it
// in one flow; mock mode keeps the legacy one-shot join (its store has no application records).
export const applyToCampaign = (
  userId: string,
  campaignId: string,
  input: creatorRealApi.CampaignApplicationInput = {},
): Promise<unknown> => (USE_REAL_API ? creatorRealApi.applyToCampaign(campaignId, input) : mockApi.apiApplyToCampaign(userId, campaignId));

// Per-application management (view/edit/resubmit/withdraw) exists only against the real backend —
// mock mode returns an empty list, so the application panel simply never renders there and the
// legacy merged-status card is used instead. Never a silent mock fallback of fake records.
export const getMyCampaignApplications = (): Promise<CampaignApplicationCreatorView[]> =>
  USE_REAL_API ? creatorRealApi.getMyCampaignApplications() : Promise.resolve([]);

// ---- Creator-to-creator referral program (6B Enhancement) — real backend only; mock mode has no
// referral data model, so these resolve to empty/zeroed results rather than fake data. ----
export type { ReferralActivityClass, ReferralSummary, ReferredFriend, ReferralReward } from "./creator-real";

const EMPTY_SUMMARY = {
  referralCode: "",
  invitationLink: "",
  totalInvited: 0,
  activeCount: 0,
  needsEncouragementCount: 0,
  earningCount: 0,
  pendingRewardMinor: 0,
  approvedRewardMinor: 0,
  paidRewardMinor: 0,
  currency: "UZS",
};

export const getReferralCode = (): Promise<{ referralCode: string; invitationLink: string }> =>
  USE_REAL_API ? creatorRealApi.getReferralCode() : Promise.resolve({ referralCode: "", invitationLink: "" });

export const getReferralSummary = (): Promise<creatorRealApi.ReferralSummary> =>
  USE_REAL_API ? creatorRealApi.getReferralSummary() : Promise.resolve(EMPTY_SUMMARY);

export const getMyReferrals = (): Promise<creatorRealApi.ReferredFriend[]> => (USE_REAL_API ? creatorRealApi.getMyReferrals() : Promise.resolve([]));

export const getMyReferralRewards = (): Promise<creatorRealApi.ReferralReward[]> =>
  USE_REAL_API ? creatorRealApi.getMyReferralRewards() : Promise.resolve([]);

// ---- Content (Phase 7A) — real backend only. The creator Content page is fully USE_REAL_API-
// gated (mock mode shows an info alert instead, same precedent as the referral dashboard's
// predecessor), so these call creator-real.ts directly with no mock branch — same convention
// already used below for updateCampaignApplication/submitCampaignApplication/etc. Renamed at this
// boundary (createContentDraft/getContentDetail/...) to avoid colliding with the legacy mock-only
// getContent/submitContent re-exported from mocks/store.ts further down.
export type { CreateContentInput, UploadContentAttachmentInput } from "./creator-real";
export {
  createContent as createContentDraft,
  getMyContents,
  getMyContentDashboardCounts,
  getContent as getContentDetail,
  updateContent as updateContentDraft,
  submitContent as submitContentDraft,
  resubmitContent as resubmitContentDraft,
  uploadContentAttachment,
  deleteContentAttachment,
} from "./creator-real";

export type { CampaignApplicationInput } from "./creator-real";
export {
  updateCampaignApplication,
  submitCampaignApplication,
  resubmitCampaignApplication,
  withdrawCampaignApplication,
} from "./creator-real";

// Onboarding CreatorApplication draft/submit/resubmit (Phase 11) — real mode calls the dedicated
// PATCH/POST /creator/onboarding/* endpoints (distinct submit-from-DRAFT vs resubmit-from-
// CHANGES_REQUESTED|REJECTED transitions, see DECISIONS.md ADR-018); mock mode's single
// apiSubmitApplication already handles both identically (no from-state guard), so resubmitApplication
// simply delegates to it there.
export const updateApplication = (
  userId: string,
  patch: Partial<import("@sofsavdo/types").CreatorApplicationData>,
  step: number,
): Promise<CreatorUser["application"]> =>
  USE_REAL_API ? creatorRealApi.updateOnboardingApplication(step, patch) : mockApi.apiUpdateApplication(userId, patch, step);

export const submitApplication = (userId: string): Promise<CreatorUser["application"]> =>
  USE_REAL_API ? creatorRealApi.submitOnboardingApplication() : mockApi.apiSubmitApplication(userId);

export const resubmitApplication = (userId: string): Promise<CreatorUser["application"]> =>
  USE_REAL_API ? creatorRealApi.resubmitOnboardingApplication() : mockApi.apiSubmitApplication(userId);

export const getSales = (userId: string): Promise<Sale[]> =>
  USE_REAL_API ? creatorRealApi.getMySales() : mockApi.apiGetSales(userId);

// Real backend (Phase J) — previously a bare, never-USE_REAL_API-gated re-export of the mock
// function (a real gap the Sofsavdo architecture review surfaced — see DECISIONS.md ADR-029).
export type { DashboardStats } from "./creator-real";
export const getDashboardStats = (userId: string): Promise<creatorRealApi.DashboardStats> =>
  USE_REAL_API ? creatorRealApi.getDashboardStats() : mockApi.apiGetDashboardStats(userId);

// ---- Leaderboard (Phase K) — real backend only, no mock counterpart (brand-new surface, same
// precedent as Content above): mock mode resolves to an empty/unranked leaderboard rather than a
// mock re-implementation of monthly Commission ranking.
export type { LeaderboardEntry, LeaderboardResponse } from "./creator-real";
export const getLeaderboard = (): Promise<creatorRealApi.LeaderboardResponse> =>
  USE_REAL_API ? creatorRealApi.getLeaderboard() : Promise.resolve({ period: "this_month", top: [], me: null });

// ---- Competitions (Phase L) — real backend only, no mock counterpart: mock mode resolves to no
// active competitions / an empty leaderboard rather than a mock reimplementation.
export type { CreatorCompetition, CompetitionLeaderboardEntry, CompetitionLeaderboardResponse } from "./creator-real";
export const getMyCompetitions = (): Promise<creatorRealApi.CreatorCompetition[]> =>
  USE_REAL_API ? creatorRealApi.getMyCompetitions() : Promise.resolve([]);
export const getCompetitionLeaderboard = (competitionId: string): Promise<creatorRealApi.CompetitionLeaderboardResponse> =>
  USE_REAL_API ? creatorRealApi.getCompetitionLeaderboard(competitionId) : Promise.resolve({ competitionId, top: [], me: null });
export const joinCompetition = (competitionId: string): Promise<{ joined: boolean }> =>
  USE_REAL_API ? creatorRealApi.joinCompetition(competitionId) : Promise.reject(new Error("Competition join is only available in real-API mode."));

// ---- Activity ticker (Phase N) — real backend only, no mock counterpart: mock mode resolves to
// an empty feed rather than a mock reimplementation of the sale/payout/contribution merge.
export type { ActivityEvent, ActivityEventType, ActivityTickerResponse } from "./creator-real";
export const getActivityTicker = (): Promise<creatorRealApi.ActivityTickerResponse> =>
  USE_REAL_API ? creatorRealApi.getActivityTicker() : Promise.resolve({ events: [] });

// ---- Creator Fund (Phase N) — real backend only, no mock counterpart: mock mode resolves to a
// zeroed/empty fund rather than a mock reimplementation of the guarded contribute-and-lock flow.
export type { CreatorFundContributionResponse, CreatorFundStatsResponse, CreatorFundLeaderboardEntry, CreatorFundLeaderboardResponse } from "./creator-real";
export const getFundStats = (): Promise<creatorRealApi.CreatorFundStatsResponse> =>
  USE_REAL_API ? creatorRealApi.getFundStats() : Promise.resolve({ totalMinor: 0, currency: "UZS", myTotalMinor: 0 });
export const getFundLeaderboard = (): Promise<creatorRealApi.CreatorFundLeaderboardResponse> =>
  USE_REAL_API ? creatorRealApi.getFundLeaderboard() : Promise.resolve({ top: [], me: null });
export const contributeToFund = (amountMinor: number, message?: string): Promise<creatorRealApi.CreatorFundContributionResponse> => {
  if (!USE_REAL_API) throw new Error("Creator Fund is only available in real-API mode.");
  return creatorRealApi.contributeToFund(amountMinor, message);
};

// Real backend (Phase M) — previously a bare, never-USE_REAL_API-gated re-export of the mock
// function (a real gap the pre-launch audit surfaced — see DECISIONS.md ADR-031). Mock mode's
// `Commission` shape (saleId/payableAt/paidAt) predates the real CreatorCommissionResponse
// contract (orderPublicToken/commissionType/currency) and is also relied on internally by
// apiGetBalance, so it's reshaped at this boundary rather than changed at its source.
export type { CreatorCommission } from "./creator-real";
export const getCommissions = async (userId: string): Promise<creatorRealApi.CreatorCommission[]> => {
  if (USE_REAL_API) return creatorRealApi.getMyCommissions();
  const mockCommissions = await mockApi.apiGetCommissions(userId);
  return mockCommissions.map((c) => ({
    id: c.id,
    orderPublicToken: c.saleId,
    campaignName: c.campaignName,
    commissionType: "PERCENTAGE",
    baseAmountMinor: c.baseAmountMinor,
    amountMinor: c.amountMinor,
    currency: "UZS",
    status: c.status,
    createdAt: c.createdAt,
  }));
};

// ---- Products (for creator dashboard) ----
export const getMyProducts = (): Promise<import("@sofsavdo/types").Product[]> =>
  USE_REAL_API ? creatorRealApi.getMyProducts() : Promise.resolve([]);

export const createMyProduct = (dto: Omit<import("@sofsavdo/types").Product, "id" | "createdAt" | "status"> & { status?: import("@sofsavdo/types").Product["status"] }): Promise<import("@sofsavdo/types").Product> =>
  USE_REAL_API ? creatorRealApi.createMyProduct(dto) : Promise.reject(new Error("Product creation is only available in real-API mode."));

export const getAvailableProductsForPromotion = (): Promise<import("@sofsavdo/types").Product[]> =>
  USE_REAL_API ? creatorRealApi.getAvailableProductsForPromotion() : Promise.resolve([]);

export const selectProductForPromotion = (productId: string): Promise<{ code: string }> =>
  USE_REAL_API ? creatorRealApi.selectProductForPromotion(productId) : Promise.reject(new Error("Product selection is only available in real-API mode."));

export {
  apiGetContent as getContent,
  apiSubmitContent as submitContent,
  apiGetBalance as getBalance,
  apiGetPayoutMethods as getPayoutMethods,
  apiAddPayoutMethod as addPayoutMethod,
  apiGetPayouts as getPayouts,
  apiRequestPayout as requestPayout,
  MockApiError as ApiError,
} from "../../mocks/store";

// ---- Checkout/Payment/Order (Phase 8) — real backend only had zero branch at all before this
// phase (validatePromoCode/createOrder/getOrderPublic were unconditional mock re-exports); now
// gated behind USE_REAL_API like getOfferPublic/getOfferQuote above. trackVisit is new — the mock
// store has no ReferralVisit concept, so mock mode resolves to a harmless no-op visitorId. ----

export const trackVisit = (offerSlug: string, refCode?: string): Promise<TrackVisitResult> =>
  USE_REAL_API ? checkoutRealApi.trackVisit(offerSlug, refCode) : Promise.resolve({ visitorId: "mock-visitor" });

export const validatePromoCode = (offerSlug: string, code: string, baseAmountMinor: number): Promise<PromoValidationResult> =>
  USE_REAL_API ? checkoutRealApi.validatePromoCode(offerSlug, code, baseAmountMinor) : mockApi.apiValidatePromoCode(offerSlug, code);

export const createOrder = (input: CreateOrderInput): Promise<CheckoutOrderResult> => {
  if (!USE_REAL_API) return mockApi.apiCreateOrder(input) as unknown as Promise<CheckoutOrderResult>;
  const { offerSlug, ...body } = input;
  return checkoutRealApi.createOrder(offerSlug, body);
};

export const getOrderPublic = (publicToken: string): Promise<CheckoutOrderResult> =>
  USE_REAL_API ? checkoutRealApi.getOrderPublic(publicToken) : (mockApi.apiGetOrderPublic(publicToken) as unknown as Promise<CheckoutOrderResult>);

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only, same
// no-mock-counterpart precedent as Content/Order above. Distinct function names avoid colliding
// with the legacy mock-only getBalance/getPayoutMethods/addPayoutMethod/getPayouts/requestPayout
// re-exported further up from mocks/store.ts. ----
export type { CreatePayoutMethodInput } from "./wallet-real";
export {
  getWalletBalance,
  getWalletTransactions,
  listPayoutMethods,
  createPayoutMethod,
  setDefaultPayoutMethod,
  deletePayoutMethod,
  listPayoutsMine,
  requestPayout as requestRealPayout,
  cancelPayout,
} from "./wallet-real";

// ---- Communication & Notification domain (Phase 10) — real backend only, no mock counterpart
// (see @sofsavdo/types' RealNotification comment). ----
export type { NotificationListQuery } from "./notifications-real";
export {
  getNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreference,
} from "./notifications-real";
