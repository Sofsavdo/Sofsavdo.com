"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LandingSectionType, Offer, Product } from "@rosti/types";
import * as api from "@/lib/api/admin";
import type { CreateOfferInput } from "@/lib/api/admin";

export function useAdminProducts() {
  return useQuery({ queryKey: ["admin-products"], queryFn: api.getProducts });
}

export function useAdminProduct(id: string) {
  return useQuery({ queryKey: ["admin-products", id], queryFn: () => api.getProduct(id), enabled: !!id });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Product, "id" | "createdAt" | "status"> & { status?: Product["status"] }) => api.createProduct(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) => api.updateProduct(id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-products", vars.id] });
    },
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });
}

export function useAdminOffers() {
  return useQuery({ queryKey: ["admin-offers"], queryFn: api.getOffers });
}

export function useAdminOffer(id: string) {
  return useQuery({ queryKey: ["admin-offers", id], queryFn: () => api.getOffer(id), enabled: !!id });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) => api.createOffer(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-offers"] }),
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Offer> }) => api.updateOffer(id, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offers", vars.id] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });
}

export function useAdminLandingSections(offerId: string) {
  return useQuery({ queryKey: ["admin-landing-sections", offerId], queryFn: () => api.getLandingSections(offerId), enabled: !!offerId });
}

export function useAddLandingSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, type }: { offerId: string; type: LandingSectionType }) => api.addLandingSection(offerId, type),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["admin-landing-sections", vars.offerId] }),
  });
}

export function useUpdateLandingSection(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { content?: Record<string, unknown>; isActive?: boolean } }) =>
      api.updateLandingSection(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing-sections", offerId] }),
  });
}

export function useToggleLandingSection(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleLandingSection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing-sections", offerId] }),
  });
}

export function useRemoveLandingSection(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeLandingSection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing-sections", offerId] }),
  });
}

export function useReorderLandingSections(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderLandingSections(offerId, orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing-sections", offerId] }),
  });
}
