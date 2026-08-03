import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { PERMISSIONS, type PermissionKey } from "./permissions.constants";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

export interface RoleResponse {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
  userCount: number;
}

// The 3 roles prisma/seed.ts always upserts (manager/admin/super_admin) are not hard-deletable-or-
// renameable via this service at all (no delete endpoint exists; UpdateRoleDto has no `key`
// field), so "prevent removal of critical system roles" (Phase 12 spec) is satisfied structurally
// rather than by a runtime check. The one additional runtime guard below (removePermission)
// prevents a narrower, still-real risk: stripping the seeded super_admin role's own management
// keys, which no structural rule alone would catch.
@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // The real source of truth for "what can this user do" — always read from the
  // Role/RolePermission/UserRole join tables, never from a JWT claim, so a role/permission
  // change takes effect on the user's very next request instead of waiting for token expiry.
  async getRoleKeysAndPermissionsForUser(userId: string): Promise<{ roleKeys: string[]; permissions: PermissionKey[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    console.log(`[RolesService] User roles for userId=${userId}: count=${userRoles.length}, roles=${JSON.stringify(userRoles.map(ur => ur.role.key))}`);

    const roleKeys = new Set<string>();
    const permissions = new Set<PermissionKey>();
    for (const ur of userRoles) {
      roleKeys.add(ur.role.key);
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key as PermissionKey);
      }
    }

    console.log(`[RolesService] Final result: roleKeys=${JSON.stringify([...roleKeys])}, permissionsCount=${permissions.size}, samplePermissions=${JSON.stringify([...permissions].slice(0, 5))}`);

    return { roleKeys: [...roleKeys], permissions: [...permissions] };
  }

  // ---- Admin Operations (Phase 12) — real role/permission management ----

  private toResponse(role: { id: string; key: string; name: string; description: string | null; permissions: { permission: { key: string } }[]; _count: { users: number } }): RoleResponse {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p) => p.permission.key as PermissionKey),
      userCount: role._count.users,
    };
  }

  async listRoles(): Promise<RoleResponse[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { key: "asc" },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    return roles.map((r) => this.toResponse(r));
  }

  // The permission matrix source — every key this codebase's RBAC understands, for the admin UI's
  // permission-assignment checkboxes. Always the full PERMISSIONS constant, not "permissions
  // currently assigned to any role" (a brand-new key exists here before any role uses it).
  listAllPermissionKeys(): PermissionKey[] {
    return [...PERMISSIONS];
  }

  private async findRoleRowOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    if (!role) throw new DomainException("NOT_FOUND", "Rol topilmadi.");
    return role;
  }

  async findRoleOrThrow(id: string): Promise<RoleResponse> {
    return this.toResponse(await this.findRoleRowOrThrow(id));
  }

  async createRole(dto: CreateRoleDto, actorId: string): Promise<RoleResponse> {
    const existing = await this.prisma.role.findUnique({ where: { key: dto.key } });
    if (existing) throw new DomainException("CONFLICT", "Bu key bilan rol allaqachon mavjud.");
    const created = await this.prisma.role.create({ data: { key: dto.key, name: dto.name, description: dto.description } });
    await this.audit.record({ actorId, action: "ROLE_CREATED", entityType: "Role", entityId: created.id, after: { key: dto.key, name: dto.name } });
    return this.findRoleOrThrow(created.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto, actorId: string): Promise<RoleResponse> {
    const existing = await this.findRoleRowOrThrow(id);
    await this.prisma.role.update({ where: { id }, data: { name: dto.name, description: dto.description } });
    await this.audit.record({
      actorId,
      action: "ROLE_UPDATED",
      entityType: "Role",
      entityId: id,
      before: { name: existing.name, description: existing.description },
      after: dto,
    });
    return this.findRoleOrThrow(id);
  }

  async assignPermission(id: string, permissionKey: PermissionKey, actorId: string): Promise<RoleResponse> {
    await this.findRoleRowOrThrow(id);
    const permission = await this.prisma.permission.findUnique({ where: { key: permissionKey } });
    if (!permission) throw new DomainException("NOT_FOUND", "Ruxsat topilmadi.");
    const existing = await this.prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: id, permissionId: permission.id } } });
    if (existing) throw new DomainException("PERMISSION_ALREADY_ASSIGNED", "Bu ruxsat allaqachon biriktirilgan.");
    await this.prisma.rolePermission.create({ data: { roleId: id, permissionId: permission.id } });
    await this.audit.record({ actorId, action: "ROLE_PERMISSION_ASSIGNED", entityType: "Role", entityId: id, after: { permissionKey } });
    return this.findRoleOrThrow(id);
  }

  async removePermission(id: string, permissionKey: string, actorId: string): Promise<RoleResponse> {
    if (!PERMISSIONS.includes(permissionKey as PermissionKey)) {
      throw new DomainException("VALIDATION_ERROR", "Noma'lum ruxsat kaliti.", { permissionKey });
    }
    const role = await this.findRoleRowOrThrow(id);
    const permission = await this.prisma.permission.findUnique({ where: { key: permissionKey } });
    if (!permission) throw new DomainException("NOT_FOUND", "Ruxsat topilmadi.");
    const link = await this.prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: id, permissionId: permission.id } } });
    if (!link) throw new DomainException("PERMISSION_NOT_ASSIGNED", "Bu ruxsat biriktirilmagan.");
    // Prevents a real self-lockout: stripping role.manage/user.manage from the seeded super_admin
    // role would leave every super-admin account (and this endpoint itself) permanently unable to
    // fix any future RBAC mistake, since super_admin is the only role these two keys are ever
    // granted to by default and there is no other path to re-grant them.
    if (role.key === "super_admin" && (permissionKey === "role.manage" || permissionKey === "user.manage")) {
      throw new DomainException("CANNOT_MODIFY_SYSTEM_ROLE", "Bu ruxsatni super_admin rolidan olib tashlab bo'lmaydi — tizimni boshqarish imkoniyati yo'qoladi.");
    }
    await this.prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId: id, permissionId: permission.id } } });
    await this.audit.record({ actorId, action: "ROLE_PERMISSION_REMOVED", entityType: "Role", entityId: id, before: { permissionKey } });
    return this.findRoleOrThrow(id);
  }
}
