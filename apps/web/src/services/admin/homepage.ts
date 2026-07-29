"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { HomepageSectionType } from "@/lib/api/admin";

const KEY = ["admin-homepage-sections"];

export function useAdminHomepageSections() {
  return useQuery({ queryKey: KEY, queryFn: api.getHomepageSectionsAdmin });
}

export function useAddHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: HomepageSectionType) => api.addHomepageSection(type),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { content?: Record<string, unknown>; isActive?: boolean; startsAt?: string | null; expiresAt?: string | null } }) =>
      api.updateHomepageSection(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useToggleHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nextIsActive }: { id: string; nextIsActive: boolean }) => api.toggleHomepageSection(id, nextIsActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeHomepageSection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReorderHomepageSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderHomepageSections(orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
