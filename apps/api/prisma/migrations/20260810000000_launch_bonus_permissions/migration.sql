-- Launch Bonus System permissions
-- This migration adds launch_bonus permissions and assigns them to roles

-- Insert launch_bonus permissions with explicit CUID generation
-- Using gen_random_uuid() as a fallback since we can't use Prisma's cuid() in raw SQL
INSERT INTO "Permission" (id, key, label) VALUES
  (gen_random_uuid(), 'launch_bonus.read', 'launch_bonus.read'),
  (gen_random_uuid(), 'launch_bonus.write', 'launch_bonus.write'),
  (gen_random_uuid(), 'launch_bonus.verify', 'launch_bonus.verify'),
  (gen_random_uuid(), 'launch_bonus.admin', 'launch_bonus.admin')
ON CONFLICT (key) DO NOTHING;

-- Assign launch_bonus permissions to admin role
-- Column names must be double-quoted to preserve case ("roleId"/"permissionId") -- unquoted,
-- Postgres folds them to lowercase ("roleid"/"permissionid"), which don't exist on this table
-- (confirmed: this migration failed with "column roleid does not exist" on every real Postgres
-- database it was ever run against -- it never successfully applied anywhere, blocking every
-- migration after it, including the entire Flow model).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'admin'
  AND p.key IN ('launch_bonus.write', 'launch_bonus.verify', 'launch_bonus.admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign launch_bonus permissions to super_admin role (inherits all admin permissions)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'super_admin'
  AND p.key IN ('launch_bonus.write', 'launch_bonus.verify', 'launch_bonus.admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign launch_bonus.read to manager role
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.key = 'manager'
  AND p.key = 'launch_bonus.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
