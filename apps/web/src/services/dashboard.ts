"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

export function useDashboardStats() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => api.getDashboardStats(user!.id),
    enabled: !!user,
  });
}
