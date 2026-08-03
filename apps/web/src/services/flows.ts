import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/http-client";

export interface Flow {
  id: string;
  creatorProfileId: string;
  productId: string;
  referralCode: string;
  status: string;
  clickCount: number;
  orderCount: number;
  commissionEarnedMinor: number;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    images: string[];
    priceMinor: number | null;
    commissionType: string | null;
    commissionRateBps: number | null;
    commissionAmountMinor: number | null;
  };
}

export interface Product {
  id: string;
  name: string;
  images: string[];
  priceMinor: number | null;
  commissionType: string | null;
  commissionRateBps: number | null;
  commissionAmountMinor: number | null;
  status: string;
}

async function createFlowFn(productId: string) {
  return apiRequest<{ flow: Flow }>("/flows", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

async function listFlowsFn() {
  return apiRequest<{ flows: Flow[] }>("/flows", {
    method: "GET",
  });
}

async function pauseFlowFn(flowId: string) {
  return apiRequest<{ flow: Flow }>(`/flows/${flowId}/pause`, {
    method: "POST",
  });
}

async function activateFlowFn(flowId: string) {
  return apiRequest<{ flow: Flow }>(`/flows/${flowId}/activate`, {
    method: "POST",
  });
}

export function useFlows() {
  return useQuery({
    queryKey: ["flows"],
    queryFn: listFlowsFn,
  });
}

export function useCreateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFlowFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function usePauseFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseFlowFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useActivateFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activateFlowFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function getReferralUrl(referralCode: string) {
  return `${window.location.origin}/r/${referralCode}`;
}
