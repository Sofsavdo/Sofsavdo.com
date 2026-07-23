// Typed admin API client — same seam pattern as lib/api/index.ts, scoped to /admin/*.
//
// NEXT_PUBLIC_API_MODE=real|mock (default mock) switches auth + the Product domain to the real
// NestJS backend (see admin-real.ts) — this is a build-time constant Next.js inlines, so the
// unused branch is tree-shaken, not a runtime toggle. Every other domain (offers, campaigns,
// creators, content, orders, payouts, analytics, ...) still points at the mock store regardless
// of this flag, because their backend modules don't exist yet — per the Phase 6B vertical-slice
// plan in PROJECT_STATUS.md, each domain's frontend wiring lands together with its own backend
// slice, not all at once.
import type {
  AdminRole,
  AdminUser,
  Campaign,
  CampaignApplicationAdminView,
  LandingPage,
  LandingSectionAdmin,
  LandingSectionType,
  Offer,
  Product,
  ProductStatus,
} from "@rosti/types";
import * as mockAdmin from "../../mocks/store";
import * as realAdmin from "./admin-real";
import type { CreateCampaignInput, CreateLandingInput, CreateOfferInput } from "../../mocks/store";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

export const adminLogin = (email: string, password: string): Promise<AdminUser> =>
  USE_REAL_API ? realAdmin.adminLogin(email, password) : mockAdmin.apiAdminLogin(email, password);

export const adminGetSession = (): Promise<AdminUser | null> =>
  USE_REAL_API ? realAdmin.adminGetSession() : mockAdmin.apiAdminGetSession();

export const adminLogout = async (): Promise<void> => {
  if (USE_REAL_API) await realAdmin.adminLogout();
  else mockAdmin.apiAdminLogout();
};

export const adminDevSwitchRole = (role: AdminRole): Promise<AdminUser> =>
  USE_REAL_API ? realAdmin.adminDevSwitchRole() : mockAdmin.apiAdminDevSwitchRole(role);

export const getProducts = (): Promise<Product[]> => (USE_REAL_API ? realAdmin.getProducts() : mockAdmin.apiAdminGetProducts());

export const getProduct = (id: string): Promise<Product | null> =>
  USE_REAL_API ? realAdmin.getProduct(id) : mockAdmin.apiAdminGetProduct(id);

export const createProduct = (
  input: Omit<Product, "id" | "createdAt" | "status"> & { status?: ProductStatus },
): Promise<Product> => (USE_REAL_API ? realAdmin.createProduct(input) : mockAdmin.apiAdminCreateProduct(input));

export const updateProduct = (id: string, patch: Partial<Product>): Promise<Product> =>
  USE_REAL_API ? realAdmin.updateProduct(id, patch) : mockAdmin.apiAdminUpdateProduct(id, patch);

export const archiveProduct = (id: string): Promise<Product> =>
  USE_REAL_API ? realAdmin.archiveProduct(id) : mockAdmin.apiAdminArchiveProduct(id);

export const getOffers = (): Promise<Offer[]> => (USE_REAL_API ? realAdmin.getOffers() : mockAdmin.apiAdminGetOffers());

export const getOffer = (id: string): Promise<Offer | null> =>
  USE_REAL_API ? realAdmin.getOffer(id) : mockAdmin.apiAdminGetOffer(id);

export const createOffer = (input: CreateOfferInput): Promise<Offer> =>
  USE_REAL_API ? realAdmin.createOffer(input) : mockAdmin.apiAdminCreateOffer(input);

export const updateOffer = (id: string, patch: Partial<Offer>): Promise<Offer> =>
  USE_REAL_API ? realAdmin.updateOffer(id, patch) : mockAdmin.apiAdminUpdateOffer(id, patch);

export const activateOffer = (id: string): Promise<Offer> =>
  USE_REAL_API ? realAdmin.activateOffer(id) : mockAdmin.apiAdminActivateOffer(id);

export const pauseOffer = (id: string): Promise<Offer> =>
  USE_REAL_API ? realAdmin.pauseOffer(id) : mockAdmin.apiAdminPauseOffer(id);

export const archiveOffer = (id: string): Promise<Offer> =>
  USE_REAL_API ? realAdmin.archiveOffer(id) : mockAdmin.apiAdminArchiveOffer(id);

export const getLanding = (offerId: string): Promise<LandingPage | null> =>
  USE_REAL_API ? realAdmin.getLanding(offerId) : mockAdmin.apiAdminGetLanding(offerId);

export const createLanding = (offerId: string, input: CreateLandingInput): Promise<LandingPage> =>
  USE_REAL_API ? realAdmin.createLanding(offerId, input) : mockAdmin.apiAdminCreateLanding(offerId, input);

export const updateLanding = (offerId: string, patch: Partial<LandingPage>): Promise<LandingPage> =>
  USE_REAL_API ? realAdmin.updateLanding(offerId, patch) : mockAdmin.apiAdminUpdateLanding(offerId, patch);

export const publishLanding = (offerId: string): Promise<LandingPage> =>
  USE_REAL_API ? realAdmin.publishLanding(offerId) : mockAdmin.apiAdminPublishLanding(offerId);

export const unpublishLanding = (offerId: string): Promise<LandingPage> =>
  USE_REAL_API ? realAdmin.unpublishLanding(offerId) : mockAdmin.apiAdminUnpublishLanding(offerId);

export const archiveLanding = (offerId: string): Promise<LandingPage> =>
  USE_REAL_API ? realAdmin.archiveLanding(offerId) : mockAdmin.apiAdminArchiveLanding(offerId);

// Mock mode has no server-authored "preview" — a DRAFT landing already renders identically to a
// PUBLISHED one via apiGetOfferPublic (mock's public read was never gated on status), so preview
// there is just the public payload; real mode uses the dedicated admin-authenticated endpoint
// that bypasses the actual publish gate.
export const previewLanding = (offerId: string) => (USE_REAL_API ? realAdmin.previewLanding(offerId) : mockAdmin.apiGetOfferPublicByOfferId(offerId));

export const getLandingSections = (offerId: string): Promise<LandingSectionAdmin[]> =>
  USE_REAL_API ? realAdmin.getLandingSections(offerId) : mockAdmin.apiAdminGetLandingSections(offerId);

export const addLandingSection = (offerId: string, type: LandingSectionType): Promise<LandingSectionAdmin> =>
  USE_REAL_API ? realAdmin.addLandingSection(offerId, type) : mockAdmin.apiAdminAddLandingSection(offerId, type);

export const updateLandingSection = (
  id: string,
  patch: Partial<Pick<LandingSectionAdmin, "content" | "isActive">>,
): Promise<LandingSectionAdmin> =>
  USE_REAL_API ? realAdmin.updateLandingSection(id, patch) : mockAdmin.apiAdminUpdateLandingSection(id, patch);

export const toggleLandingSection = (id: string, nextIsActive: boolean): Promise<LandingSectionAdmin> =>
  USE_REAL_API ? realAdmin.toggleLandingSection(id, nextIsActive) : mockAdmin.apiAdminToggleLandingSection(id);

export const removeLandingSection = (id: string): Promise<void> =>
  USE_REAL_API ? realAdmin.removeLandingSection(id) : mockAdmin.apiAdminRemoveLandingSection(id);

export const reorderLandingSections = (offerId: string, orderedIds: string[]): Promise<LandingSectionAdmin[]> =>
  USE_REAL_API ? realAdmin.reorderLandingSections(offerId, orderedIds) : mockAdmin.apiAdminReorderLandingSections(offerId, orderedIds);

export const getCampaigns = (): Promise<Campaign[]> => (USE_REAL_API ? realAdmin.getCampaigns() : mockAdmin.apiAdminGetCampaigns());

export const getCampaign = (id: string): Promise<Campaign | null> =>
  USE_REAL_API ? realAdmin.getCampaign(id) : mockAdmin.apiAdminGetCampaign(id);

export const createCampaign = (input: CreateCampaignInput): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.createCampaign(input) : mockAdmin.apiAdminCreateCampaign(input);

export const updateCampaign = (id: string, patch: Partial<Campaign>): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.updateCampaign(id, patch) : mockAdmin.apiAdminUpdateCampaign(id, patch);

export const activateCampaign = (id: string): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.activateCampaign(id) : mockAdmin.apiAdminActivateCampaign(id);

export const pauseCampaign = (id: string): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.pauseCampaign(id) : mockAdmin.apiAdminPauseCampaign(id);

export const completeCampaign = (id: string): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.completeCampaign(id) : mockAdmin.apiAdminCompleteCampaign(id);

export const archiveCampaign = (id: string): Promise<Campaign> =>
  USE_REAL_API ? realAdmin.archiveCampaign(id) : mockAdmin.apiAdminArchiveCampaign(id);

// ---- Campaign-application review (Creator Application domain) — real backend only. Mock mode's
// legacy per-campaign approve/reject lives on the campaign detail page via the mock-era
// getCampaignApplications export below; this richer review workflow has no mock counterpart, so
// the list resolves empty there (no fake records, no silent fallback).
export type { CampaignApplicationListQuery } from "./admin-real";

export const getCampaignApplicationList = (
  query?: realAdmin.CampaignApplicationListQuery,
): ReturnType<typeof realAdmin.getCampaignApplicationList> =>
  USE_REAL_API
    ? realAdmin.getCampaignApplicationList(query)
    : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });

export const getCampaignApplication = (id: string): Promise<CampaignApplicationAdminView | null> =>
  USE_REAL_API ? realAdmin.getCampaignApplication(id) : Promise.resolve(null);

export const startReviewCampaignApplication = (id: string): Promise<CampaignApplicationAdminView> =>
  realAdmin.startReviewCampaignApplication(id);

export const approveCampaignApplicationReview = (id: string): Promise<CampaignApplicationAdminView> =>
  realAdmin.approveCampaignApplicationReview(id);

export const rejectCampaignApplicationReview = (id: string, reason: string): Promise<CampaignApplicationAdminView> =>
  realAdmin.rejectCampaignApplicationReview(id, reason);

export const requestChangesCampaignApplication = (id: string, reason: string): Promise<CampaignApplicationAdminView> =>
  realAdmin.requestChangesCampaignApplication(id, reason);

// ---- Campaign media, delivery regions, referrals (6B Enhancement) — real backend only, same
// no-mock-counterpart precedent as Campaign-application review above. ----
export type {
  UploadMediaInput,
  DeliveryRegionAdminItem,
  DeliveryRegionInput,
  AdminReferralItem,
  AdminReferralQuery,
  AdminReferralReward,
  ReferralActivityClass,
  ReferralRule,
  ReferralRuleInput,
} from "./admin-real";

export const getCampaignMedia = (campaignId: string) => realAdmin.getCampaignMedia(campaignId);
export const uploadCampaignMedia = (campaignId: string, input: realAdmin.UploadMediaInput) => realAdmin.uploadCampaignMedia(campaignId, input);
export const replaceCampaignCover = (campaignId: string, input: realAdmin.UploadMediaInput) => realAdmin.replaceCampaignCover(campaignId, input);
export const setCampaignMediaCover = (mediaId: string) => realAdmin.setCampaignMediaCover(mediaId);
export const reorderCampaignMedia = (campaignId: string, orderedIds: string[]) => realAdmin.reorderCampaignMedia(campaignId, orderedIds);
export const updateCampaignMediaAltText = (mediaId: string, altText: string) => realAdmin.updateCampaignMediaAltText(mediaId, altText);
export const deleteCampaignMedia = (mediaId: string) => realAdmin.deleteCampaignMedia(mediaId);

export const getDeliveryRegions = (offerId: string) => realAdmin.getDeliveryRegions(offerId);
export const createDeliveryRegion = (offerId: string, input: realAdmin.DeliveryRegionInput) => realAdmin.createDeliveryRegion(offerId, input);
export const updateDeliveryRegion = (id: string, input: Partial<realAdmin.DeliveryRegionInput>) => realAdmin.updateDeliveryRegion(id, input);
export const deleteDeliveryRegion = (id: string) => realAdmin.deleteDeliveryRegion(id);

export const getAdminReferrals = (query?: realAdmin.AdminReferralQuery) =>
  USE_REAL_API ? realAdmin.getAdminReferrals(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getAdminReferral = (id: string) => realAdmin.getAdminReferral(id);
export const disqualifyReferral = (id: string, reason: string) => realAdmin.disqualifyReferral(id, reason);
export const getReferralRules = () => (USE_REAL_API ? realAdmin.getReferralRules() : Promise.resolve([]));
export const createReferralRule = (input: realAdmin.ReferralRuleInput) => realAdmin.createReferralRule(input);
export const updateReferralRule = (id: string, input: Partial<realAdmin.ReferralRuleInput>) => realAdmin.updateReferralRule(id, input);
export const activateReferralRule = (id: string) => realAdmin.activateReferralRule(id);
export const deactivateReferralRule = (id: string) => realAdmin.deactivateReferralRule(id);
export const approveReferralReward = (id: string) => realAdmin.approveReferralReward(id);
export const rejectReferralReward = (id: string, reason: string) => realAdmin.rejectReferralReward(id, reason);

// ---- Content review (Phase 7A) — real backend only, same no-mock-counterpart precedent as
// Campaign-application review above. Renamed at this boundary (getContentReviewList/
// approveContentReview/...) to avoid colliding with the legacy mock-only getAllContent/
// approveContent/requestContentRevision/rejectContent re-exported further down. ----
export type { ContentListQuery } from "./admin-real";
export const getContentReviewList = (query?: realAdmin.ContentListQuery) =>
  USE_REAL_API ? realAdmin.getContentList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getContentReviewDetail = (id: string) => realAdmin.getContentDetail(id);
export const startReviewContent = (id: string) => realAdmin.startReviewContent(id);
export const approveContentReview = (id: string, comment?: string) => realAdmin.approveContentReview(id, comment);
export const rejectContentReview = (id: string, reason: string) => realAdmin.rejectContentReview(id, reason);
export const requestChangesContent = (id: string, reason: string) => realAdmin.requestChangesContent(id, reason);

// ---- Order management (Phase 8) — real backend only, same no-mock-counterpart precedent as
// Content review above. Renamed at this boundary (getOrderReviewList/updateRealOrderStatus/...)
// to avoid colliding with the legacy mock-only getOrders/getOrder/updateOrderStatus/
// updateOrderNotes/createRefund re-exported further down. ----
export type { OrderListQuery } from "./admin-real";
export const getOrderReviewList = (query?: realAdmin.OrderListQuery) =>
  USE_REAL_API ? realAdmin.getOrderList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getOrderReviewDetail = (id: string) => realAdmin.getOrderDetail(id);
export const updateRealOrderStatus = (id: string, status: import("@rosti/types").RealOrderStatus, note?: string) => realAdmin.updateOrderStatusReal(id, status, note);
export const updateRealOrderNotes = (id: string, notes: string) => realAdmin.updateOrderNotesReal(id, notes);
export const createRealOrderRefund = (id: string, amountMinor: number, reason: string) => realAdmin.createOrderRefund(id, amountMinor, reason);

export {
  apiAdminGetDashboard as getDashboard,

  apiAdminGetCampaignApplications as getCampaignApplications,
  apiAdminApproveCampaignApplication as approveCampaignApplication,
  apiAdminRejectCampaignApplication as rejectCampaignApplication,

  apiAdminGetCreators as getCreators,
  apiAdminGetCreator as getCreator,
  apiAdminGetCreatorCampaignHistory as getCreatorCampaignHistory,
  apiAdminGetCreatorStats as getCreatorStats,
  apiAdminApproveCreatorApplication as approveCreatorApplication,
  apiAdminRejectCreatorApplication as rejectCreatorApplication,
  apiAdminRequestCreatorRevision as requestCreatorRevision,
  apiAdminSetCreatorAccountStatus as setCreatorAccountStatus,

  apiAdminGetAllContent as getAllContent,
  apiAdminApproveContent as approveContent,
  apiAdminRequestContentRevision as requestContentRevision,
  apiAdminRejectContent as rejectContent,

  apiAdminGetReferralLinks as getReferralLinks,
  apiAdminGetPromoCodes as getPromoCodes,
  apiAdminDeactivateReferralLink as deactivateReferralLink,

  apiAdminGetVisitors as getVisitors,
  apiAdminOverrideAttribution as overrideAttribution,

  apiAdminGetOrders as getOrders,
  apiAdminGetOrder as getOrder,
  apiAdminUpdateOrderStatus as updateOrderStatus,
  apiAdminUpdateOrderNotes as updateOrderNotes,

  apiAdminGetPayments as getPayments,
  apiAdminGetRefunds as getRefunds,
  apiAdminCreateRefund as createRefund,

  apiAdminGetCommissions as getCommissions,
  apiAdminManualAdjustCommission as manualAdjustCommission,

  apiAdminGetPayouts as getPayouts,
  apiAdminApprovePayout as approvePayout,
  apiAdminRejectPayout as rejectPayout,
  apiAdminMarkPayoutPaid as markPayoutPaid,

  apiAdminGetAnalytics as getAnalytics,
  apiAdminExportAnalyticsCsv as exportAnalyticsCsv,

  apiAdminGetUsers as getUsers,
  apiAdminGetRoles as getRoles,
  apiAdminGetSettings as getSettings,
  apiAdminUpdateSettings as updateSettings,
  apiAdminGetAuditLog as getAuditLog,

  MockApiError as ApiError,
} from "../../mocks/store";

export type { CreateOfferInput, CreateLandingInput, CreateCampaignInput, AnalyticsFilters, PlatformSettings } from "../../mocks/store";
