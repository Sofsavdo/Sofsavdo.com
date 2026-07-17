// Typed API client. Every function here matches one endpoint in API.md by name/shape.
// Today every one of them is backed by src/mocks/store.ts (in-memory + localStorage, simulated
// latency, realistic error cases). Phase 6 swaps each function's body for a `fetch` call against
// apps/api — call sites in src/services/*.ts never change, because the *shape* (async in, typed
// out, can throw) is already what a real HTTP call would look like.
export {
  apiLogin as login,
  apiRegister as register,
  apiForgotPassword as forgotPassword,
  apiLogout as logout,
  apiGetSession as getSession,
  apiUpdateApplication as updateApplication,
  apiSubmitApplication as submitApplication,
  apiGetCampaigns as getCampaigns,
  apiGetCampaign as getCampaign,
  apiGetMyCampaigns as getMyCampaigns,
  apiApplyToCampaign as applyToCampaign,
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
  apiGetOfferPublic as getOfferPublic,
  apiValidatePromoCode as validatePromoCode,
  apiCreateOrder as createOrder,
  apiGetOrderPublic as getOrderPublic,
  MockApiError as ApiError,
} from "../../mocks/store";
