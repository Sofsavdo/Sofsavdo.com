"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/services/adminSession";

// `permission` is the real, effective permission key this page requires — NOT a role-tier name.
// Gating on a role tier (the pre-fix version of this component used `min: AdminRole`) silently
// locked out any custom role: `AdminUser.role` is only a coarse 3-tier label derived from role KEY
// NAME, so a custom role granted e.g. "user.manage" still collapsed to the lowest tier and got
// bounced here regardless. See DECISIONS.md's Roles/RBAC ADR.
export function RoleGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAdminSession();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!user.permissions.includes(permission)) router.replace("/admin/forbidden");
  }, [isLoading, user, permission, router]);

  if (isLoading || !user || !user.permissions.includes(permission)) return null;
  return <>{children}</>;
}
