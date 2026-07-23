"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateOrderInput } from "@rosti/types";
import * as api from "../lib/api";

export function useOfferPublic(slug: string, refCode?: string) {
  return useQuery({
    queryKey: ["offer-public", slug, refCode ?? null],
    queryFn: () => api.getOfferPublic(slug, refCode),
  });
}

// Authoritative price quote (6B Enhancement) — the backend computes the total, this hook never
// does its own arithmetic. Disabled until a region is picked for a PHYSICAL_PRODUCT offer (the
// caller passes `enabled` based on productType — see OfferLandingPageClient).
export function useOfferQuote(slug: string, regionCode: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["offer-quote", slug, regionCode ?? null],
    queryFn: () => api.getOfferQuote(slug, regionCode),
    enabled,
  });
}

export function useValidatePromoCode() {
  return useMutation({
    mutationFn: ({ offerSlug, code, baseAmountMinor }: { offerSlug: string; code: string; baseAmountMinor: number }) =>
      api.validatePromoCode(offerSlug, code, baseAmountMinor),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
  });
}

export function useOrderPublic(publicToken: string) {
  return useQuery({
    queryKey: ["order-public", publicToken],
    queryFn: () => api.getOrderPublic(publicToken),
  });
}

// Records a page view against a ReferralLink code (Phase 8) — fires once per checkout page
// mount, before the buyer submits anything. Real mode only stores anything; mock mode's stub
// visitorId is never persisted anywhere, it just keeps the call site uniform.
export function useTrackVisit() {
  return useMutation({
    mutationFn: ({ offerSlug, refCode }: { offerSlug: string; refCode?: string }) => api.trackVisit(offerSlug, refCode),
  });
}
