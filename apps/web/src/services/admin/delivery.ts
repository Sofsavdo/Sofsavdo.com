"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { DeliveryRegionInput } from "@/lib/api/admin";

export function useDeliveryRegions(offerId: string) {
  return useQuery({ queryKey: ["admin-delivery-regions", offerId], queryFn: () => api.getDeliveryRegions(offerId), enabled: !!offerId });
}

function useRegionMutation<TVars>(offerId: string, mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-delivery-regions", offerId] }),
  });
}

export function useCreateDeliveryRegion(offerId: string) {
  return useRegionMutation(offerId, (input: DeliveryRegionInput) => api.createDeliveryRegion(offerId, input));
}

export function useUpdateDeliveryRegion(offerId: string) {
  return useRegionMutation(offerId, ({ id, input }: { id: string; input: Partial<DeliveryRegionInput> }) => api.updateDeliveryRegion(id, input));
}

export function useDeleteDeliveryRegion(offerId: string) {
  return useRegionMutation(offerId, (id: string) => api.deleteDeliveryRegion(id));
}
