// Real-backend implementation of the creator-facing Wallet/Commission Settlement/Payout domain
// (Phase 9) — counterpart to checkout-real.ts. Everything here was 100% mock before this phase
// (see services/finance.ts's useBalance/useCommissions/usePayoutMethods/usePayouts, which had zero
// real branch at all until now). Distinct function names avoid colliding with the legacy mock-only
// apiGetBalance/apiGetCommissions/apiGetPayoutMethods/apiAddPayoutMethod/apiGetPayouts/
// apiRequestPayout re-exported from mocks/store.ts.
import type { RealPayout, RealPayoutMethod, RealWalletBalance, RealWalletTransaction } from "@sofsavdo/types";
import { apiRequest } from "./http-client";

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function getWalletBalance(): Promise<RealWalletBalance> {
  return apiRequest<RealWalletBalance>("/creator/wallet/balance");
}

export async function getWalletTransactions(page = 1, pageSize = 20): Promise<PaginatedResponse<RealWalletTransaction>> {
  return apiRequest<PaginatedResponse<RealWalletTransaction>>(`/creator/wallet/transactions?page=${page}&pageSize=${pageSize}`);
}

export async function listPayoutMethods(): Promise<RealPayoutMethod[]> {
  return apiRequest<RealPayoutMethod[]>("/creator/payout-methods");
}

export type CreatePayoutMethodInput =
  | { type: "CARD"; cardNumber: string; cardHolder: string }
  | { type: "BANK_ACCOUNT"; bankName: string; bankAccount: string };

export async function createPayoutMethod(input: CreatePayoutMethodInput): Promise<RealPayoutMethod> {
  return apiRequest<RealPayoutMethod>("/creator/payout-methods", { method: "POST", body: input });
}

export async function setDefaultPayoutMethod(id: string): Promise<RealPayoutMethod> {
  return apiRequest<RealPayoutMethod>(`/creator/payout-methods/${id}/set-default`, { method: "PATCH" });
}

export async function deletePayoutMethod(id: string): Promise<void> {
  await apiRequest<void>(`/creator/payout-methods/${id}`, { method: "DELETE" });
}

export async function listPayoutsMine(page = 1, pageSize = 20): Promise<PaginatedResponse<RealPayout>> {
  return apiRequest<PaginatedResponse<RealPayout>>(`/creator/payouts?page=${page}&pageSize=${pageSize}`);
}

export async function requestPayout(input: { amountMinor: number; payoutMethodId: string }): Promise<RealPayout> {
  return apiRequest<RealPayout>("/creator/payouts", { method: "POST", body: input });
}

export async function cancelPayout(id: string): Promise<RealPayout> {
  return apiRequest<RealPayout>(`/creator/payouts/${id}/cancel`, { method: "POST" });
}
