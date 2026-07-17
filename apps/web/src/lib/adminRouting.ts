import type { AdminRole } from "@rosti/types";

const ROLE_RANK: Record<AdminRole, number> = { MANAGER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function hasRole(role: AdminRole | undefined, min: AdminRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  MANAGER: "Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
