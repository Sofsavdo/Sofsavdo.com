"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export function useLaunchBonusSettings() {
  return useQuery({ queryKey: ["launch-bonus-settings"], queryFn: api.getLaunchBonusSettings });
}

export function useUpdateLaunchBonusSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.updateLaunchBonusSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["launch-bonus-settings"] }),
  });
}

export function usePendingBioVerifications() {
  return useQuery({ queryKey: ["pending-bio-verifications"], queryFn: api.getPendingBioVerifications });
}

export function useVerifyBioLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorProfileId, approved }: { creatorProfileId: string; approved: boolean }) =>
      api.verifyBioLink(creatorProfileId, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-bio-verifications"] });
      qc.invalidateQueries({ queryKey: ["admin-creators-real"] });
    },
  });
}

export function useCheckBonuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.checkBonuses(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-bio-verifications"] });
      qc.invalidateQueries({ queryKey: ["admin-creators-real"] });
    },
  });
}
