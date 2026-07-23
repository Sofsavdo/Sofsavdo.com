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
} from "@rosti/types";
import type { CheckoutOrderResult, CreateOrderInput, PromoValidationResult, TrackVisitResult } from "@rosti/types";
import * as mockApi from "../../mocks/store";
import * as publicRealApi from "./public-real";
import * as creatorRealApi from "./creator-real";
import * as checkoutRealApi from "./checkout-real";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

export const getOfferPublic = (
  slug: string,
  refCode?: string,
): Promise<{ offer: Offer; productType: ProductType; deliveryRegions: DeliveryRegionPublic[]; sections: LandingSectionAdmin[]; referral?: ReferralContext } | null> =>
  USE_REAL_API ? publicRealApi.getOfferPublic(slug, refCode) : mockApi.apiGetOfferPublic(slug, refCode);

export const getOfferQuote = (slug: string, regionCode?: string): Promise<OfferQuote> =>
  USE_REAL_API ? publicRealApi.getOfferQuote(slug, regionCode) : mockApi.apiGetOfferQuote(slug);

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

export {
  apiUpdateApplication as updateApplication,
  apiSubmitApplication as submitApplication,
  apiGetContent as getContent,
  apiSubmitContent as submitContent,
  apiGetSales as getSales,
  apiGetCommissions as getCommissions,
  apiGetBalance as getBalance,
  apiGetPayoutMethods as getPayoutMethods,
  apiAddPayoutMethod as addPayoutMethod,
  apiGetPayouts as getPayouts,
  apiRequestPayout as requestPayout,
  apiGetDashboardStats as getDashboardStats,
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
