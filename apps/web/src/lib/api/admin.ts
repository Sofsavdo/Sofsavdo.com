// Typed admin API client — same seam pattern as lib/api/index.ts, scoped to /admin/*.
//
// NEXT_PUBLIC_API_MODE=real|mock (default mock) switches auth + the Product domain to the real
// NestJS backend (see admin-real.ts) — this is a build-time constant Next.js inlines, so the
// unused branch is tree-shaken, not a runtime toggle. Some domains (offers, campaigns, content,
// orders, ...) still point at the mock store regardless of this flag, because their backend
// modules don't exist yet — per the Phase 6B vertical-slice plan in PROJECT_STATUS.md, each
// domain's frontend wiring lands together with its own backend slice, not all at once. Others
// (Users/Roles/Creators/Payments/Refunds/Settings/Audit — Phase 12; Analytics — Phase 13) are
// wired real-only below, with no mock branch at all, since their backend now fully exists.
import type {
  AdminRole,
  AdminUser,
  AnalyticsFilters,
  Campaign,
  CampaignApplicationAdminView,
  LandingPage,
  LandingSectionAdmin,
  LandingSectionType,
  Offer,
  Product,
  ProductStatus,
} from "@sofsavdo/types";
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

// Real-only, no mock counterpart — same convention as every other brand-new admin action surface
// this platform has added (Competitions, Telegram linking, ...).
export const pinProduct = (id: string): Promise<Product> =>
  USE_REAL_API ? realAdmin.pinProduct(id) : Promise.reject(new Error("Product pinning is only available in real-API mode."));
export const unpinProduct = (id: string): Promise<Product> =>
  USE_REAL_API ? realAdmin.unpinProduct(id) : Promise.reject(new Error("Product pinning is only available in real-API mode."));

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

export const addLandingSection = (offerId: string, type: LandingSectionType, content?: Record<string, unknown>): Promise<LandingSectionAdmin> =>
  USE_REAL_API ? realAdmin.addLandingSection(offerId, type, content) : mockAdmin.apiAdminAddLandingSection(offerId, type, content);

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

export const uploadImage = (file: File) => realAdmin.uploadImage(file);

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
export const seedStandardDeliveryRegions = (offerId: string) => realAdmin.seedStandardDeliveryRegions(offerId);

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
export const updateRealOrderStatus = (id: string, status: import("@sofsavdo/types").RealOrderStatus, note?: string) => realAdmin.updateOrderStatusReal(id, status, note);
export const updateRealOrderNotes = (id: string, notes: string) => realAdmin.updateOrderNotesReal(id, notes);
export const createRealOrderRefund = (id: string, amountMinor: number, reason: string) => realAdmin.createOrderRefund(id, amountMinor, reason);

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only, same
// no-mock-counterpart precedent as Order management above. Renamed at this boundary
// (getCommissionSettlementList/approveCommission/...) to avoid colliding with the legacy
// mock-only getCommissions/manualAdjustCommission/getPayouts/approvePayout/rejectPayout/
// markPayoutPaid re-exported further down. ----
export type { AdminPayoutQuery, CommissionSettlementQuery } from "./admin-real";
export const getCommissionSettlementList = (query?: realAdmin.CommissionSettlementQuery) =>
  USE_REAL_API ? realAdmin.getCommissionSettlementList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getCommissionSettlementDetail = (id: string) => realAdmin.getCommissionSettlementDetail(id);
export const approveCommission = (id: string) => realAdmin.approveCommission(id);
export const rejectCommission = (id: string, reason: string) => realAdmin.rejectCommission(id, reason);
export const markCommissionPayable = (id: string) => realAdmin.markCommissionPayable(id);

export const getAdminPayoutList = (query?: realAdmin.AdminPayoutQuery) =>
  USE_REAL_API ? realAdmin.getAdminPayoutList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getAdminPayoutDetail = (id: string) => realAdmin.getAdminPayoutDetail(id);
export const approveAdminPayout = (id: string) => realAdmin.approveAdminPayout(id);
export const rejectAdminPayout = (id: string, reason: string) => realAdmin.rejectAdminPayout(id, reason);
export const markAdminPayoutProcessing = (id: string) => realAdmin.markAdminPayoutProcessing(id);
export const markAdminPayoutPaid = (id: string) => realAdmin.markAdminPayoutPaid(id);
export const markAdminPayoutFailed = (id: string, reason: string) => realAdmin.markAdminPayoutFailed(id, reason);

// ---- Communication & Notification domain (Phase 10) — real backend only, no mock counterpart
// (see @sofsavdo/types' RealNotification comment). ----
export type { AdminNotificationQuery } from "./admin-real";
export const getAdminNotificationList = (query?: realAdmin.AdminNotificationQuery) =>
  USE_REAL_API ? realAdmin.getAdminNotificationList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getAdminFailedNotificationList = (query?: Omit<realAdmin.AdminNotificationQuery, "status">) =>
  USE_REAL_API ? realAdmin.getAdminFailedNotificationList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const retryAdminNotification = (id: string) => realAdmin.retryAdminNotification(id);

// ---- Creator Onboarding & Admin Review domain (Phase 11) — real backend only, same
// no-mock-counterpart precedent as Content review/Order management above. Distinct from the
// legacy mock-only getCreators/approveCreatorApplication/rejectCreatorApplication/
// requestCreatorRevision re-exported further down (which stay untouched — this is a genuinely new
// review surface, not a replacement). ----
export type { OnboardingQuery } from "./admin-real";
export const getOnboardingApplicationList = (query?: realAdmin.OnboardingQuery) =>
  USE_REAL_API ? realAdmin.getOnboardingApplicationList(query) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
export const getOnboardingApplicationDetail = (id: string) => realAdmin.getOnboardingApplicationDetail(id);
export const getOnboardingAuditTrail = (id: string) => realAdmin.getOnboardingAuditTrail(id);
export const startReviewOnboardingApplication = (id: string) => realAdmin.startReviewOnboardingApplication(id);
export const approveOnboardingApplication = (id: string) => realAdmin.approveOnboardingApplication(id);
export const rejectOnboardingApplication = (id: string, reason: string) => realAdmin.rejectOnboardingApplication(id, reason);
export const requestChangesOnboardingApplication = (id: string, reason: string) => realAdmin.requestChangesOnboardingApplication(id, reason);

// ---- Admin Operations domain (Phase 12) — real backend only, no mock counterpart. These pages
// replace their mock predecessors entirely (no Real/Mock branch) — same "real-only by design"
// precedent as admin/notifications (Phase 10): the mock store's fixed 3-value AdminRole and
// trivial getUsers/getRoles/getSettings/getAuditLog/getCreators/getPayments/getRefunds (left
// untouched below, now simply unused by any page) cannot represent this phase's real, dynamic
// Role/Permission model or richer creator/payment/refund/settings/audit surfaces without
// building parallel mock CRUD this phase's own scope excludes ("No mock mode additions"). See
// DECISIONS.md ADR-019. ----

export type { UserQuery, CreateStaffUserInput } from "./admin-real";
export const getStaffUserList = (query?: realAdmin.UserQuery) => realAdmin.getStaffUserList(query);
export const getStaffUserDetail = (id: string) => realAdmin.getStaffUserDetail(id);
export const createStaffUser = (input: realAdmin.CreateStaffUserInput) => realAdmin.createStaffUser(input);
export const updateStaffUser = (id: string, input: Partial<Pick<realAdmin.CreateStaffUserInput, "displayName" | "email" | "phone">>) => realAdmin.updateStaffUser(id, input);
export const activateStaffUser = (id: string) => realAdmin.activateStaffUser(id);
export const deactivateStaffUser = (id: string) => realAdmin.deactivateStaffUser(id);
export const resetStaffUserPassword = (id: string, newPassword: string) => realAdmin.resetStaffUserPassword(id, newPassword);
export const assignStaffUserRole = (id: string, roleId: string) => realAdmin.assignStaffUserRole(id, roleId);
export const removeStaffUserRole = (id: string, roleId: string) => realAdmin.removeStaffUserRole(id, roleId);

export const getRealRoleList = () => realAdmin.getRealRoleList();
export const getRealRoleDetail = (id: string) => realAdmin.getRealRoleDetail(id);
export const getAllPermissionKeys = () => realAdmin.getAllPermissionKeys();
export const createRealRole = (input: { key: string; name: string; description?: string }) => realAdmin.createRealRole(input);
export const updateRealRole = (id: string, input: { name?: string; description?: string }) => realAdmin.updateRealRole(id, input);
export const assignRolePermission = (id: string, permissionKey: string) => realAdmin.assignRolePermission(id, permissionKey);
export const removeRolePermission = (id: string, permissionKey: string) => realAdmin.removeRolePermission(id, permissionKey);

export type { RealCreatorQuery } from "./admin-real";
export const getRealCreatorList = (query?: realAdmin.RealCreatorQuery) => realAdmin.getRealCreatorList(query);
export const getRealCreatorDetail = (id: string) => realAdmin.getRealCreatorDetail(id);
export const getRealCreatorCampaignHistory = (id: string) => realAdmin.getRealCreatorCampaignHistory(id);
export const getRealCreatorEarningsSummary = (id: string) => realAdmin.getRealCreatorEarningsSummary(id);
export const getRealCreatorPayoutSummary = (id: string) => realAdmin.getRealCreatorPayoutSummary(id);
export const getRealCreatorReferralSummary = (id: string) => realAdmin.getRealCreatorReferralSummary(id);
export const suspendRealCreator = (id: string, reason: string) => realAdmin.suspendRealCreator(id, reason);
export const unsuspendRealCreator = (id: string) => realAdmin.unsuspendRealCreator(id);
export const blockRealCreator = (id: string, reason: string) => realAdmin.blockRealCreator(id, reason);
export const unblockRealCreator = (id: string) => realAdmin.unblockRealCreator(id);
export const setCreatorBioCompliance = (id: string, status: import("@sofsavdo/types").BioComplianceStatus) => realAdmin.setCreatorBioCompliance(id, status);
export const setCreatorTier = (id: string, tier: import("@sofsavdo/types").CreatorTier) => realAdmin.setCreatorTier(id, tier);

export type { RealPaymentQuery } from "./admin-real";
export const getRealPaymentList = (query?: realAdmin.RealPaymentQuery) => realAdmin.getRealPaymentList(query);
export const getRealPaymentDetail = (id: string) => realAdmin.getRealPaymentDetail(id);
export const getRealPaymentTimeline = (id: string) => realAdmin.getRealPaymentTimeline(id);

export type { RealRefundQuery } from "./admin-real";
export const getRealRefundList = (query?: realAdmin.RealRefundQuery) => realAdmin.getRealRefundList(query);
export const getRealRefundDetail = (id: string) => realAdmin.getRealRefundDetail(id);
export const approveRealRefund = (id: string) => realAdmin.approveRealRefund(id);
export const rejectRealRefund = (id: string, reason: string) => realAdmin.rejectRealRefund(id, reason);

export const getRealSettings = () => realAdmin.getRealSettings();
export const updateRealSettings = (values: Record<string, string | number | boolean>) => realAdmin.updateRealSettings(values);

export type { TelegramLinkStatus, TelegramLinkToken } from "./admin-real";
export const getTelegramLinkStatus = () => realAdmin.getTelegramLinkStatus();
export const createTelegramLinkToken = () => realAdmin.createTelegramLinkToken();
export const unlinkTelegram = () => realAdmin.unlinkTelegram();

export type { RealAuditQuery } from "./admin-real";
export const getRealAuditLogList = (query?: realAdmin.RealAuditQuery) => realAdmin.getRealAuditLogList(query);
export const getRealAuditLogDetail = (id: string) => realAdmin.getRealAuditLogDetail(id);

// ---- Analytics & Business Intelligence (Phase 13) — real backend only, no mock counterpart. ----
export const getRealExecutiveAnalytics = (filters: AnalyticsFilters) => realAdmin.getRealExecutiveAnalytics(filters);
export const getRealCreatorAnalyticsList = (filters: AnalyticsFilters) => realAdmin.getRealCreatorAnalyticsList(filters);
export const getRealCreatorAnalyticsDetail = (id: string, filters: AnalyticsFilters) => realAdmin.getRealCreatorAnalyticsDetail(id, filters);
export const getRealCampaignAnalyticsList = (filters: AnalyticsFilters) => realAdmin.getRealCampaignAnalyticsList(filters);
export const getRealCampaignAnalyticsDetail = (id: string, filters: AnalyticsFilters) => realAdmin.getRealCampaignAnalyticsDetail(id, filters);
export const getRealProductAnalyticsList = (filters: AnalyticsFilters) => realAdmin.getRealProductAnalyticsList(filters);
export const getRealProductAnalyticsDetail = (id: string, filters: AnalyticsFilters) => realAdmin.getRealProductAnalyticsDetail(id, filters);
export const getRealPaymentAnalytics = (filters: AnalyticsFilters) => realAdmin.getRealPaymentAnalytics(filters);
export const getRealRefundAnalytics = (filters: AnalyticsFilters) => realAdmin.getRealRefundAnalytics(filters);
export const getRealCustomerAnalytics = (filters: AnalyticsFilters) => realAdmin.getRealCustomerAnalytics(filters);
export const exportRealAnalyticsCsv = (view: string, filters: AnalyticsFilters) => realAdmin.exportRealAnalyticsCsv(view, filters);

// ---- Homepage CMS (Phase H) — real backend only, no mock counterpart, same precedent as
// Analytics above: this is a brand-new admin surface with no legacy mock behavior to preserve. ----
export type { HomepageSectionAdmin, HomepageSectionType } from "./admin-real";
export const getHomepageSectionsAdmin = () => realAdmin.getHomepageSectionsAdmin();
export const addHomepageSection = (type: realAdmin.HomepageSectionType) => realAdmin.addHomepageSection(type);
export const updateHomepageSection = (id: string, patch: Parameters<typeof realAdmin.updateHomepageSection>[1]) =>
  realAdmin.updateHomepageSection(id, patch);
export const toggleHomepageSection = (id: string, nextIsActive: boolean) => realAdmin.toggleHomepageSection(id, nextIsActive);
export const removeHomepageSection = (id: string) => realAdmin.removeHomepageSection(id);
export const reorderHomepageSections = (orderedIds: string[]) => realAdmin.reorderHomepageSections(orderedIds);

// ---- Competitions (Phase L) — real backend only, no mock counterpart. ----
export type { CompetitionAdmin, CompetitionStatus, CompetitionAvailability, CreateCompetitionInput } from "./admin-real";
export const getCompetitions = () => realAdmin.getCompetitions();
export const getCompetition = (id: string) => realAdmin.getCompetition(id);
export const createCompetition = (input: realAdmin.CreateCompetitionInput) => realAdmin.createCompetition(input);
export const updateCompetition = (id: string, patch: Partial<realAdmin.CreateCompetitionInput>) => realAdmin.updateCompetition(id, patch);
export const publishCompetition = (id: string) => realAdmin.publishCompetition(id);
export const completeCompetition = (id: string) => realAdmin.completeCompetition(id);
export const archiveCompetition = (id: string) => realAdmin.archiveCompetition(id);

export type { CompetitionParticipantAdmin, CompetitionParticipantStatus } from "./admin-real";
export const getCompetitionParticipants = (competitionId: string) => realAdmin.getCompetitionParticipants(competitionId);
export const approveCompetitionParticipant = (participantId: string) => realAdmin.approveCompetitionParticipant(participantId);
export const rejectCompetitionParticipant = (participantId: string, reason: string) => realAdmin.rejectCompetitionParticipant(participantId, reason);
export const updateCompetitionParticipantViewCount = (participantId: string, viewCount: number) =>
  realAdmin.updateCompetitionParticipantViewCount(participantId, viewCount);
export const refreshCompetitionParticipantViewCount = (participantId: string) => realAdmin.refreshCompetitionParticipantViewCount(participantId);

// ---- AI Product Creation Engine (Phase I) — real backend only, no mock counterpart. ----
export type { ProductAiDraft, GenerateProductDraftInput } from "./admin-real";
export const generateProductDraft = (input: realAdmin.GenerateProductDraftInput) => realAdmin.generateProductDraft(input);

// ---- Admin executive dashboard (Phase M) — real backend only. Previously a bare, never-
// USE_REAL_API-gated re-export of the mock function (a real gap — see DECISIONS.md ADR-031).
export type { AdminDashboardResponse } from "./admin-real";
export const getDashboard = () => realAdmin.getDashboard();

// ---- Referral links / promo codes / visitors (Phase M) — real backend only, same "previously a
// bare mock re-export" gap this pre-launch audit surfaced (see DECISIONS.md ADR-031).
export const getReferralLinks = () => realAdmin.getReferralLinks();
export const deactivateReferralLink = (code: string) => realAdmin.deactivateReferralLink(code);
export const getPromoCodes = () => realAdmin.getPromoCodes();
export const getVisitors = () => realAdmin.getVisitors();
// overrideAttribution has no real implementation yet — rejects loudly rather than pretending
// success (see admin-real.ts's own comment). Kept as a real function, not silently dropped, so a
// future real implementation is a one-function change, not a re-discovery of this gap.
export const overrideAttribution = (_orderId: string, _newCreatorId: string, _reason: string) => realAdmin.overrideAttribution();

// ---- Launch Bonus System (Creator Growth Strategy) — real backend only, no mock counterpart. ----
export const getLaunchBonusSettings = () => realAdmin.getLaunchBonusSettings();
export const updateLaunchBonusSettings = (data: any) => realAdmin.updateLaunchBonusSettings(data);
export const getPendingBioVerifications = () => realAdmin.getPendingBioVerifications();
export const verifyBioLink = (creatorProfileId: string, approved: boolean) => realAdmin.verifyBioLink(creatorProfileId, approved);
export const checkBonuses = () => realAdmin.checkBonuses();

export {
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

  apiAdminGetUsers as getUsers,
  apiAdminGetRoles as getRoles,
  apiAdminGetSettings as getSettings,
  apiAdminUpdateSettings as updateSettings,
  apiAdminGetAuditLog as getAuditLog,

  MockApiError as ApiError,
} from "../../mocks/store";

export type { CreateOfferInput, CreateLandingInput, CreateCampaignInput, PlatformSettings } from "../../mocks/store";
