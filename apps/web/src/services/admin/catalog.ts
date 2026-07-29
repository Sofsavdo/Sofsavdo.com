"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LandingPage, LandingSectionType, Offer, Product } from "@sofsavdo/types";
import * as api from "@/lib/api/admin";
import type { CreateLandingInput, CreateOfferInput } from "@/lib/api/admin";

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

export function useActivateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.activateOffer(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offers", id] });
    },
  });
}

export function usePauseOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pauseOffer(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offers", id] });
    },
  });
}

export function useArchiveOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveOffer(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offers", id] });
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });
}

export function useAdminLanding(offerId: string) {
  return useQuery({ queryKey: ["admin-landing", offerId], queryFn: () => api.getLanding(offerId), enabled: !!offerId });
}

export function usePreviewLanding(offerId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin-landing-preview", offerId],
    queryFn: () => api.previewLanding(offerId),
    enabled: !!offerId && enabled,
  });
}

export function useCreateLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, input }: { offerId: string; input: CreateLandingInput }) => api.createLanding(offerId, input),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["admin-landing", vars.offerId] }),
  });
}

export function useUpdateLanding(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LandingPage>) => api.updateLanding(offerId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-landing", offerId] }),
  });
}

export function usePublishLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => api.publishLanding(offerId),
    onSuccess: (_data, offerId) => qc.invalidateQueries({ queryKey: ["admin-landing", offerId] }),
  });
}

export function useUnpublishLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => api.unpublishLanding(offerId),
    onSuccess: (_data, offerId) => qc.invalidateQueries({ queryKey: ["admin-landing", offerId] }),
  });
}

export function useArchiveLanding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => api.archiveLanding(offerId),
    onSuccess: (_data, offerId) => qc.invalidateQueries({ queryKey: ["admin-landing", offerId] }),
  });
}

export function useAdminLandingSections(offerId: string) {
  return useQuery({ queryKey: ["admin-landing-sections", offerId], queryFn: () => api.getLandingSections(offerId), enabled: !!offerId });
}

export function useAddLandingSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, type, content }: { offerId: string; type: LandingSectionType; content?: Record<string, unknown> }) =>
      api.addLandingSection(offerId, type, content),
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
    mutationFn: ({ id, nextIsActive }: { id: string; nextIsActive: boolean }) => api.toggleLandingSection(id, nextIsActive),
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
