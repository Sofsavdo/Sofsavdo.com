import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAccessToken } from "@/lib/api/http-client";

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
    description: string | null;
    images: string[];
    videos: string[];
    commissionType: string | null;
    commissionRateBps: number | null;
    commissionAmountMinor: number | null;
    // Product has no price of its own — it lives on the one active Offer behind it (an
    // internal implementation detail never surfaced to creators as a separate concept).
    offers: { priceMinor: number; compareAtPriceMinor: number | null; currency: string }[];
    // Set only for a partner-platform redirect (e.g. Fidem) — see Product.externalRedirectUrl's
    // schema comment. When set, offers is always empty, so priceMinor-derived earnings estimates
    // are meaningless; estimatedEarningLabel is the admin-entered replacement to show instead.
    externalRedirectUrl: string | null;
    estimatedEarningLabel: string | null;
  };
}

async function createFlowFn(productId: string) {
  // apiRequest already JSON.stringifies `body` itself (see http-client.ts) — passing a
  // pre-stringified string here double-encoded it into a JSON string literal, which the backend's
  // ValidationPipe rejected as not matching CreateFlowDto's shape. Every "Oqim olish" click was
  // silently failing on this alone (compounded by the button's onClick never handling the
  // rejected promise, so the failure was invisible to the creator).
  //
  // FlowsController's handlers all return the raw Prisma result directly (never wrapped in
  // `{ flow: ... }` / `{ flows: ... }`) — these were typed as if they were wrapped, so
  // `.flow`/`.flows` was `undefined` on the real response every single time. Combined with the
  // double-stringify bug above, this meant even a successfully-created Flow could never actually
  // be found in the list afterward — "Mening oqimlarim" stayed empty regardless.
  return apiRequest<Flow>("/flows", {
    method: "POST",
    body: { productId },
  });
}

async function listFlowsFn() {
  return apiRequest<Flow[]>("/flows", {
    method: "GET",
  });
}

async function pauseFlowFn(flowId: string) {
  return apiRequest<Flow>(`/flows/${flowId}/pause`, {
    method: "POST",
  });
}

async function activateFlowFn(flowId: string) {
  return apiRequest<Flow>(`/flows/${flowId}/activate`, {
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

// A plain <a href> can't carry the Bearer token this endpoint requires (browsers don't attach
// Authorization headers to ordinary navigation), so this fetches the watermarked image as a blob
// with the real auth header and triggers the save-as dialog itself via a throwaway object URL.
export async function downloadWatermarkedImage(flowId: string, imageIndex: number, filename: string): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${apiBase}/flows/${flowId}/images/${imageIndex}/download`, {
    headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
  });
  if (!res.ok) throw new Error("Rasmni yuklab bo'lmadi.");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
