// Real-backend implementation of the buyer-facing Checkout/Payment/Order seam (Phase 8) —
// counterpart to public-real.ts (which only covers the read-only offer/landing/quote endpoints).
// Everything here was 100% mock before this phase (see lib/api/index.ts's validatePromoCode/
// createOrder/getOrderPublic, which had zero real branch at all until now).
import type { CheckoutOrderResult, CreateOrderInput, PromoValidationResult, TrackVisitResult } from "@sofsavdo/types";
import { apiRequest } from "./http-client";

export async function trackVisit(offerSlug: string, refCode?: string): Promise<TrackVisitResult> {
  return apiRequest<TrackVisitResult>(`/offers/${offerSlug}/visit`, { method: "POST", body: { refCode } });
}

export async function validatePromoCode(offerSlug: string, code: string, baseAmountMinor: number): Promise<PromoValidationResult> {
  return apiRequest<PromoValidationResult>(`/offers/${offerSlug}/promo-code/validate`, { method: "POST", body: { code, baseAmountMinor } });
}

// `customer.comment` (the frontend's field name, shared with the mock store) is renamed to
// `notes` here — the backend's CustomerInfoDto (apps/api/src/orders/dto/customer-info.dto.ts)
// uses `notes`, and ValidationPipe's forbidNonWhitelisted would 400 on an unrecognized `comment`
// key if it weren't remapped at this boundary.
export async function createOrder(offerSlug: string, input: Omit<CreateOrderInput, "offerSlug">): Promise<CheckoutOrderResult> {
  const { comment, ...customerRest } = input.customer;
  const body = { ...input, customer: { ...customerRest, notes: comment } };
  return apiRequest<CheckoutOrderResult>(`/offers/${offerSlug}/checkout`, { method: "POST", body });
}

export async function getOrderPublic(publicToken: string): Promise<CheckoutOrderResult> {
  return apiRequest<CheckoutOrderResult>(`/orders/public/${publicToken}`);
}
