"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyLaunchBonus } from "@/lib/api/creator-real";
import { apiRequest } from "@/lib/api/http-client";

export function useMyLaunchBonus() {
  return useQuery({
    queryKey: ["my-launch-bonus"],
    queryFn: getMyLaunchBonus,
  });
}

export function useSubmitBioLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ bioLinkSubmittedAt: string }>("/launch-bonus/submit-bio", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-launch-bonus"] });
    },
  });
}
