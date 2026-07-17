"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@rosti/types";
import { useAdminSession } from "@/services/adminSession";
import { hasRole } from "@/lib/adminRouting";

export function RoleGuard({ min, children }: { min: AdminRole; children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAdminSession();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!hasRole(user.role, min)) router.replace("/admin/forbidden");
  }, [isLoading, user, min, router]);

  if (isLoading || !user || !hasRole(user.role, min)) return null;
  return <>{children}</>;
}
