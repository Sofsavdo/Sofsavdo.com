"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";
import type { CreateCompetitionInput } from "@/lib/api/admin-real";

export function useAdminCompetitions() {
  return useQuery({ queryKey: ["admin-competitions"], queryFn: api.getCompetitions });
}

export function useAdminCompetition(id: string) {
  return useQuery({ queryKey: ["admin-competitions", id], queryFn: () => api.getCompetition(id), enabled: !!id });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompetitionInput) => api.createCompetition(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-competitions"] }),
  });
}

export function useUpdateCompetition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CreateCompetitionInput>) => api.updateCompetition(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-competitions"] });
      qc.invalidateQueries({ queryKey: ["admin-competitions", id] });
    },
  });
}

export function usePublishCompetition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.publishCompetition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-competitions"] });
      qc.invalidateQueries({ queryKey: ["admin-competitions", id] });
    },
  });
}

export function useCompleteCompetition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.completeCompetition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-competitions"] });
      qc.invalidateQueries({ queryKey: ["admin-competitions", id] });
    },
  });
}

export function useArchiveCompetition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.archiveCompetition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-competitions"] });
      qc.invalidateQueries({ queryKey: ["admin-competitions", id] });
    },
  });
}
