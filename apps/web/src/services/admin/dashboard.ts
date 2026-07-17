"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/admin";

export function useAdminDashboard() {
  return useQuery({ queryKey: ["admin-dashboard"], queryFn: api.getDashboard });
}
