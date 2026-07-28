import type { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "../../src/roles/permissions.constants";

// Extracted from seed.ts so it can also be called by bootstrap-admin.ts (the production-safe
// script — see that file's header comment) without duplicating this logic. Unlike the rest of
// seed.ts, this touches only the Permission/Role/RolePermission tables — real reference data every
// environment needs for RBAC to function at all, never fake demo content, so it's safe to run
// against production (and does run there, via bootstrap-admin.ts).
export async function seedRolesAndPermissions(prisma: PrismaClient): Promise<void> {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, label: key },
    });
  }

  const roleDefs: { key: "manager" | "admin" | "super_admin"; name: string }[] = [
    { key: "manager", name: "Manager" },
    { key: "admin", name: "Admin" },
    { key: "super_admin", name: "Super Admin" },
  ];

  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      update: { name: def.name },
      create: { key: def.key, name: def.name },
    });
    const permKeys = DEFAULT_ROLE_PERMISSIONS[def.key];
    const permissions = await prisma.permission.findMany({ where: { key: { in: permKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}
