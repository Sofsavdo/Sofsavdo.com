"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

// `enabled` override — every real page that renders these is already unreachable by a not-yet-
// APPROVED creator (CreatorAppGuard bounces them to /creator/dashboard first), except the
// dashboard itself, which needs to skip these approval-gated calls entirely for a pending creator
// rather than let them 403.
export function useCampaigns(opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["campaigns"], queryFn: api.getCampaigns, enabled: opts.enabled ?? true });
}

export function useCampaign(id: string) {
  return useQuery({ queryKey: ["campaigns", id], queryFn: () => api.getCampaign(id) });
}

export function useMyCampaigns(opts: { enabled?: boolean } = {}) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-campaigns", user?.id],
    queryFn: () => api.getMyCampaigns(user!.id),
    enabled: !!user && (opts.enabled ?? true),
  });
}

export function useApplyToCampaign() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input?: api.CampaignApplicationInput }) => {
      if (!user) throw new Error("Not authenticated");
      return api.applyToCampaign(user.id, campaignId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-campaigns", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });
}

// ---- Per-application management (real backend only — mock resolves an empty list, so the
// application panel never renders there; see lib/api/index.ts) ----

export function useMyApplications() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: api.getMyCampaignApplications,
    enabled: !!user,
  });
}

// ---- Products (for creator dashboard) ----
export function useMyProducts(opts: { enabled?: boolean } = {}) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-products", user?.id],
    queryFn: api.getMyProducts,
    enabled: !!user && (opts.enabled ?? true),
  });
}

export function useCreateMyProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Omit<import("@sofsavdo/types").Product, "id" | "createdAt" | "status"> & { status?: import("@sofsavdo/types").Product["status"] }) => api.createMyProduct(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-products"] }),
  });
}

export function useAvailableProductsForPromotion(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["available-products"],
    queryFn: api.getAvailableProductsForPromotion,
    enabled: opts.enabled ?? true,
  });
}

export function useSelectProductForPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => api.selectProductForPromotion(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["available-products"] }),
  });
}

function useApplicationMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["my-campaigns", user?.id] });
    },
  });
}

export function useUpdateApplication() {
  return useApplicationMutation(({ id, input }: { id: string; input: api.CampaignApplicationInput }) =>
    api.updateCampaignApplication(id, input),
  );
}

export function useResubmitApplication() {
  return useApplicationMutation((id: string) => api.resubmitCampaignApplication(id));
}

export function useWithdrawApplication() {
  return useApplicationMutation((id: string) => api.withdrawCampaignApplication(id));
}
