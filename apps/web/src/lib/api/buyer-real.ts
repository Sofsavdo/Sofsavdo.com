// Real-backend implementation of the buyer-facing API seam — real backend only, like Content
// (Phase 7A) and Featured Offers (Phase C): this is a brand-new principal type with no legacy
// mock to preserve. Reuses the same http-client (in-memory access token) as admin/creator — a
// buyer session replaces whichever session was active before in the same browser tab, same
// existing behavior as switching between admin/creator sessions.
import { apiRequest, setAccessToken, ApiError } from "./http-client";

export interface BuyerUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
}

interface BackendSessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  roleKeys: string[];
  creatorId: string | null;
}

function toBuyerUser(sessionUser: BackendSessionUser): BuyerUser {
  return { id: sessionUser.id, email: sessionUser.email, phone: sessionUser.phone, displayName: null };
}

export async function registerBuyer(input: { email?: string; phone?: string; password: string; fullName: string }): Promise<BuyerUser> {
  const result = await apiRequest<{ accessToken: string; user: BackendSessionUser }>("/auth/register-buyer", {
    method: "POST",
    body: input,
  });
  setAccessToken(result.accessToken);
  return { ...toBuyerUser(result.user), displayName: input.fullName };
}

export async function login(email: string, password: string): Promise<BuyerUser> {
  const result = await apiRequest<{ accessToken: string; user: BackendSessionUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setAccessToken(result.accessToken);
  return toBuyerUser(result.user);
}

// Same fresh-page-load bootstrap pattern as admin-real.ts/creator-real.ts: no in-memory token yet,
// apiRequest's 401-then-refresh recovers it from the HttpOnly cookie automatically. Must NOT pass
// skipRefreshOnAuthError here — see creator-real.ts's getSession for the full explanation of the
// bug this caused (every full page reload logged the buyer out even with a valid refresh cookie).
export async function getSession(): Promise<BuyerUser | null> {
  try {
    const sessionUser = await apiRequest<BackendSessionUser>("/auth/me");
    return toBuyerUser(sessionUser);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 401) return null;
    throw err;
  }
}

export async function logout(): Promise<void> {
  setAccessToken(null);
  await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
}

export interface BuyerOrderSummary {
  id: string;
  publicToken: string;
  status: string;
  offerName: string;
  totalMinor: number;
  currency: string;
  createdAt: string;
  payment: { provider: string; status: string } | null;
}

export interface BuyerOrderDetail extends BuyerOrderSummary {
  offer: { id: string; name: string; slug: string };
  items: { id: string; nameSnapshot: string; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  address: { region: string; city: string; district: string | null; line1: string; comment: string | null } | null;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  payment: { provider: string; status: string } | null;
  statusHistory: { toStatus: string; createdAt: string }[];
}

export function getMyOrders(): Promise<BuyerOrderSummary[]> {
  return apiRequest<BuyerOrderSummary[]>("/buyer/orders");
}

export function getMyOrder(id: string): Promise<BuyerOrderDetail> {
  return apiRequest<BuyerOrderDetail>(`/buyer/orders/${id}`);
}

export interface SavedProductResponse {
  offerId: string;
  offer: { id: string; slug: string; name: string; priceMinor: number; currency: string; imageUrl: string | null };
  createdAt: string;
}

export function getSavedProducts(): Promise<SavedProductResponse[]> {
  return apiRequest<SavedProductResponse[]>("/buyer/saved-products");
}

export function saveProduct(offerId: string): Promise<void> {
  return apiRequest<void>(`/buyer/saved-products/${offerId}`, { method: "POST" });
}

export function unsaveProduct(offerId: string): Promise<void> {
  return apiRequest<void>(`/buyer/saved-products/${offerId}`, { method: "DELETE" });
}

export interface BuyerAddress {
  id: string;
  label: string | null;
  region: string;
  city: string;
  district: string | null;
  line1: string;
  comment: string | null;
  isDefault: boolean;
}

// Deliberately its own shape, not derived from BuyerAddress via Omit: the response type's
// nullable DB fields are `string | null`, but a submitted form naturally produces `string |
// undefined` for fields the user left blank — matching CreateBuyerAddressDto's own optional
// (`?`) fields on the backend, not the read-side nullability.
export interface CreateBuyerAddressInput {
  label?: string;
  region: string;
  city: string;
  district?: string;
  line1: string;
  comment?: string;
}

export function getMyAddresses(): Promise<BuyerAddress[]> {
  return apiRequest<BuyerAddress[]>("/buyer/addresses");
}

export function createAddress(input: CreateBuyerAddressInput): Promise<BuyerAddress> {
  return apiRequest<BuyerAddress>("/buyer/addresses", { method: "POST", body: input });
}

export function updateAddress(id: string, patch: Partial<CreateBuyerAddressInput>): Promise<BuyerAddress> {
  return apiRequest<BuyerAddress>(`/buyer/addresses/${id}`, { method: "PATCH", body: patch });
}

export function setDefaultAddress(id: string): Promise<BuyerAddress> {
  return apiRequest<BuyerAddress>(`/buyer/addresses/${id}/set-default`, { method: "PATCH" });
}

export function deleteAddress(id: string): Promise<void> {
  return apiRequest<void>(`/buyer/addresses/${id}`, { method: "DELETE" });
}
