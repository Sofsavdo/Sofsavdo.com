-- Ensure launch_bonus permissions exist and are assigned to admin role
-- This migration fixes the permission issue where admin users couldn't access launch bonus settings

-- Insert launch_bonus permissions if they don't exist
INSERT INTO "Permission" (key, label)
VALUES 
  ('launch_bonus.read', 'launch_bonus.read'),
  ('launch_bonus.write', 'launch_bonus.write'),
  ('launch_bonus.verify', 'launch_bonus.verify'),
  ('launch_bonus.admin', 'launch_bonus.admin')
ON CONFLICT (key) DO NOTHING;

-- Get the admin role ID
DO $$
DECLARE
  admin_role_id UUID;
  launch_bonus_read_id UUID;
  launch_bonus_write_id UUID;
  launch_bonus_verify_id UUID;
  launch_bonus_admin_id UUID;
BEGIN
  -- Get admin role
  SELECT id INTO admin_role_id FROM "Role" WHERE key = 'admin';
  
  -- Get permission IDs
  SELECT id INTO launch_bonus_read_id FROM "Permission" WHERE key = 'launch_bonus.read';
  SELECT id INTO launch_bonus_write_id FROM "Permission" WHERE key = 'launch_bonus.write';
  SELECT id INTO launch_bonus_verify_id FROM "Permission" WHERE key = 'launch_bonus.verify';
  SELECT id INTO launch_bonus_admin_id FROM "Permission" WHERE key = 'launch_bonus.admin';
  
  -- Assign permissions to admin role if not already assigned
  INSERT INTO "RolePermission" ("roleId", "permissionId")
  VALUES 
    (admin_role_id, launch_bonus_read_id),
    (admin_role_id, launch_bonus_write_id),
    (admin_role_id, launch_bonus_verify_id),
    (admin_role_id, launch_bonus_admin_id)
  ON CONFLICT ("roleId", "permissionId") DO NOTHING;
END $$;
