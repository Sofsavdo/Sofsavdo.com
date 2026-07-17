"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SocialPlatform } from "@rosti/types";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useContent() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["content", user?.id],
    queryFn: () => api.getContent(user!.id),
    enabled: !!user,
  });
}

export function useSubmitContent() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      creatorCampaignId: string;
      campaignName: string;
      caption: string;
      platform: SocialPlatform;
      draftFileNames: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      return api.submitContent(user.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", user?.id] });
    },
  });
}
