"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreatorApplicationData } from "@rosti/types";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useUpdateApplication() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patch, step }: { patch: Partial<CreatorApplicationData>; step: number }) => {
      if (!user) throw new Error("Not authenticated");
      return api.updateApplication(user.id, patch, step);
    },
    onSuccess: (application) => {
      queryClient.setQueryData(["session"], (prev: typeof user) => (prev ? { ...prev, application } : prev));
    },
  });
}

export function useSubmitApplication() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Not authenticated");
      return api.submitApplication(user.id);
    },
    onSuccess: (application) => {
      queryClient.setQueryData(["session"], (prev: typeof user) => (prev ? { ...prev, application } : prev));
    },
  });
}
