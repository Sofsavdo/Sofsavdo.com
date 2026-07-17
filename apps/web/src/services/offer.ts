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

export function useValidatePromoCode() {
  return useMutation({
    mutationFn: ({ offerSlug, code }: { offerSlug: string; code: string }) => api.validatePromoCode(offerSlug, code),
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
