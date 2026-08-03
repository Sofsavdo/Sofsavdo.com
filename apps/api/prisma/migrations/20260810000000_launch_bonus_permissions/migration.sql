-- Launch Bonus System permissions
-- This migration ensures the launch_bonus permissions exist in the database
-- and are properly assigned to the admin and super_admin roles.

-- Insert launch_bonus permissions if they don't exist
INSERT INTO "Permission" (key, label) VALUES
  ('launch_bonus.read', 'launch_bonus.read'),
  ('launch_bonus.write', 'launch_bonus.write'),
  ('launch_bonus.verify', 'launch_bonus.verify'),
  ('launch_bonus.admin', 'launch_bonus.admin')
ON CONFLICT (key) DO NOTHING;

-- Assign launch_bonus permissions to admin role
INSERT INTO "RolePermission" (roleId, permissionId)
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'admin'
  AND p.key IN ('launch_bonus.write', 'launch_bonus.verify', 'launch_bonus.admin')
ON CONFLICT (roleId, permissionId) DO NOTHING;

-- Assign launch_bonus permissions to super_admin role (inherits all admin permissions)
INSERT INTO "RolePermission" (roleId, permissionId)
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'super_admin'
  AND p.key IN ('launch_bonus.write', 'launch_bonus.verify', 'launch_bonus.admin')
ON CONFLICT (roleId, permissionId) DO NOTHING;

-- Assign launch_bonus.read to manager role
INSERT INTO "RolePermission" (roleId, permissionId)
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'manager'
  AND p.key = 'launch_bonus.read'
ON CONFLICT (roleId, permissionId) DO NOTHING;
