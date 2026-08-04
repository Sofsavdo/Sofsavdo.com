-- Fixes a real gap left by 20260810000000_launch_bonus_permissions: that migration granted
-- admin/super_admin write/verify/admin on launch_bonus but never read, diverging from
-- apps/api/src/roles/permissions.constants.ts's DEFAULT_ROLE_PERMISSIONS (which nests
-- launch_bonus.read inside MANAGER_PERMISSIONS, spread into both ADMIN_PERMISSIONS and
-- SUPER_ADMIN_PERMISSIONS). Confirmed real-world effect: GET /launch-bonus/settings
-- (gated on launch_bonus.read) 403s for admin/super_admin even though the admin UI's own
-- RoleGuard (gated on launch_bonus.write, which IS granted) lets the page render -- the page
-- loads, the data call fails. This migration only adds the missing grant; it never removes
-- anything, so it's safe to apply even if seedRolesAndPermissions() has already patched this
-- in some environment (ON CONFLICT DO NOTHING makes it a no-op there).

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key IN ('admin', 'super_admin')
  AND p.key = 'launch_bonus.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
