// Typed admin API client — same seam pattern as lib/api/index.ts, scoped to /admin/*.
export {
  apiAdminLogin as adminLogin,
  apiAdminLogout as adminLogout,
  apiAdminGetSession as adminGetSession,
  apiAdminDevSwitchRole as adminDevSwitchRole,

  apiAdminGetDashboard as getDashboard,

  apiAdminGetProducts as getProducts,
  apiAdminGetProduct as getProduct,
  apiAdminCreateProduct as createProduct,
  apiAdminUpdateProduct as updateProduct,
  apiAdminArchiveProduct as archiveProduct,

  apiAdminGetOffers as getOffers,
  apiAdminGetOffer as getOffer,
  apiAdminCreateOffer as createOffer,
  apiAdminUpdateOffer as updateOffer,

  apiAdminGetLandingSections as getLandingSections,
  apiAdminAddLandingSection as addLandingSection,
  apiAdminUpdateLandingSection as updateLandingSection,
  apiAdminToggleLandingSection as toggleLandingSection,
  apiAdminRemoveLandingSection as removeLandingSection,
  apiAdminReorderLandingSections as reorderLandingSections,

  apiAdminGetCampaigns as getCampaigns,
  apiAdminGetCampaign as getCampaign,
  apiAdminCreateCampaign as createCampaign,
  apiAdminUpdateCampaign as updateCampaign,

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

export type { CreateOfferInput, CreateCampaignInput, AnalyticsFilters, PlatformSettings } from "../../mocks/store";
