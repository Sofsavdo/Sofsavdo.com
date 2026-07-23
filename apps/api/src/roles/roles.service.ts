import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PermissionKey } from "./permissions.constants";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // The real source of truth for "what can this user do" — always read from the
  // Role/RolePermission/UserRole join tables, never from a JWT claim, so a role/permission
  // change takes effect on the user's very next request instead of waiting for token expiry.
  async getRoleKeysAndPermissionsForUser(userId: string): Promise<{ roleKeys: string[]; permissions: PermissionKey[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const roleKeys = new Set<string>();
    const permissions = new Set<PermissionKey>();
    for (const ur of userRoles) {
      roleKeys.add(ur.role.key);
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key as PermissionKey);
      }
    }
    return { roleKeys: [...roleKeys], permissions: [...permissions] };
  }
}
