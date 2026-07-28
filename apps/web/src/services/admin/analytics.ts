"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { AnalyticsFilters } from "@rosti/types";
import * as api from "@/lib/api/admin";

export function useExecutiveAnalytics(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-executive", filters], queryFn: () => api.getRealExecutiveAnalytics(filters) });
}

export function useCreatorAnalyticsList(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-creators", filters], queryFn: () => api.getRealCreatorAnalyticsList(filters) });
}

export function useCreatorAnalyticsDetail(id: string, filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-creator", id, filters], queryFn: () => api.getRealCreatorAnalyticsDetail(id, filters), enabled: !!id });
}

export function useCampaignAnalyticsList(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-campaigns", filters], queryFn: () => api.getRealCampaignAnalyticsList(filters) });
}

export function useCampaignAnalyticsDetail(id: string, filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-campaign", id, filters], queryFn: () => api.getRealCampaignAnalyticsDetail(id, filters), enabled: !!id });
}

export function useProductAnalyticsList(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-products", filters], queryFn: () => api.getRealProductAnalyticsList(filters) });
}

export function useProductAnalyticsDetail(id: string, filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-product", id, filters], queryFn: () => api.getRealProductAnalyticsDetail(id, filters), enabled: !!id });
}

export function usePaymentAnalytics(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-payments", filters], queryFn: () => api.getRealPaymentAnalytics(filters) });
}

export function useRefundAnalytics(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-refunds", filters], queryFn: () => api.getRealRefundAnalytics(filters) });
}

export function useCustomerAnalytics(filters: AnalyticsFilters) {
  return useQuery({ queryKey: ["analytics-customers", filters], queryFn: () => api.getRealCustomerAnalytics(filters) });
}

export function useExportAnalyticsCsv() {
  return useMutation({ mutationFn: ({ view, filters }: { view: string; filters: AnalyticsFilters }) => api.exportRealAnalyticsCsv(view, filters) });
}
