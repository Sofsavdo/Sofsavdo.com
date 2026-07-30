import type { AdminRole } from "@sofsavdo/types";

// Display-only now — the coarse 3-tier role label shown in the sidebar footer and the dev
// role-switcher. Real page/section gating checks AdminUser.permissions directly (RoleGuard,
// AdminShell's nav filter) — see DECISIONS.md's Roles/RBAC ADR for why the old tier-based
// `hasRole()` gate was removed (it silently locked custom roles out of pages they were actually
// granted access to).
export const ROLE_LABELS: Record<AdminRole, string> = {
  MANAGER: "Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
