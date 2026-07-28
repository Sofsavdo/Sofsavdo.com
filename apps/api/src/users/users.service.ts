import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { UserQueryDto } from "./dto/user-query.dto";

export interface StaffUserResponse {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { id: string; key: string; name: string }[];
}

const STAFF_SELECT = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

// Thin read layer over `User` originally (auth-only, see the module's own history); Phase 12
// (Admin Operations) adds the real staff-account CRUD this domain never had — see DECISIONS.md
// ADR-019. "Staff" here means any User with at least one Role — the same table also backs creator
// accounts (see AdminCreatorsService), scoped apart by `roles: { some: {} }` everywhere below.
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private toResponse(u: StaffRow): StaffUserResponse {
    return {
      id: u.id,
      email: u.email,
      phone: u.phone,
      displayName: u.displayName,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role),
    };
  }

  async list(query: UserQueryDto): Promise<PaginatedResult<StaffUserResponse>> {
    const where: Prisma.UserWhereInput = {
      roles: { some: query.roleKey ? { role: { key: query.roleKey } } : {} },
      status: query.status,
      ...(query.search
        ? { OR: [{ displayName: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: STAFF_SELECT, orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items.map((u) => this.toResponse(u)), total, query);
  }

  private async findStaffOrThrow(id: string): Promise<StaffRow> {
    const user = await this.prisma.user.findFirst({ where: { id, roles: { some: {} } }, select: STAFF_SELECT });
    if (!user) throw new DomainException("NOT_FOUND", "Foydalanuvchi topilmadi.");
    return user;
  }

  async findOneOrThrow(id: string): Promise<StaffUserResponse> {
    return this.toResponse(await this.findStaffOrThrow(id));
  }

  async create(dto: CreateUserDto, actorId: string): Promise<StaffUserResponse> {
    if (!dto.email && !dto.phone) {
      throw new DomainException("VALIDATION_ERROR", "Email yoki telefon raqami kiritilishi shart.");
    }
    if (dto.email && (await this.prisma.user.findUnique({ where: { email: dto.email } }))) {
      throw new DomainException("EMAIL_TAKEN", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    if (dto.phone && (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))) {
      throw new DomainException("PHONE_TAKEN", "Bu telefon raqami allaqachon ro'yxatdan o'tgan.");
    }
    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
    if (roles.length !== dto.roleIds.length) {
      throw new DomainException("NOT_FOUND", "Ko'rsatilgan rollardan biri topilmadi.");
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        displayName: dto.displayName,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      select: STAFF_SELECT,
    });
    await this.audit.record({ actorId, action: "STAFF_CREATED", entityType: "User", entityId: created.id, after: { email: dto.email, displayName: dto.displayName, roleIds: dto.roleIds } });
    return this.toResponse(created);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<StaffUserResponse> {
    const existing = await this.findStaffOrThrow(id);
    if (dto.email && dto.email !== existing.email && (await this.prisma.user.findUnique({ where: { email: dto.email } }))) {
      throw new DomainException("EMAIL_TAKEN", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    if (dto.phone && dto.phone !== existing.phone && (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))) {
      throw new DomainException("PHONE_TAKEN", "Bu telefon raqami allaqachon ro'yxatdan o'tgan.");
    }
    await this.prisma.user.update({ where: { id }, data: { displayName: dto.displayName, email: dto.email, phone: dto.phone } });
    await this.audit.record({ actorId, action: "STAFF_UPDATED", entityType: "User", entityId: id, before: { displayName: existing.displayName, email: existing.email, phone: existing.phone }, after: dto });
    return this.findOneOrThrow(id);
  }

  // A staff member deactivating/reactivating their own account is never allowed — see
  // DomainException CANNOT_MODIFY_SELF. Prevents the last-logged-in-super-admin lockout scenario;
  // there is always at least one other SUPER_ADMIN able to reverse a mistaken deactivation.
  private assertNotSelf(id: string, actorId: string, message: string): void {
    if (id === actorId) throw new DomainException("CANNOT_MODIFY_SELF", message);
  }

  async activate(id: string, actorId: string): Promise<StaffUserResponse> {
    await this.findStaffOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
    await this.audit.record({ actorId, action: "STAFF_ACTIVATED", entityType: "User", entityId: id });
    return this.findOneOrThrow(id);
  }

  async deactivate(id: string, actorId: string): Promise<StaffUserResponse> {
    this.assertNotSelf(id, actorId, "O'zingizni faolsizlantira olmaysiz.");
    await this.findStaffOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { status: "SUSPENDED" } });
    await this.audit.record({ actorId, action: "STAFF_DEACTIVATED", entityType: "User", entityId: id });
    return this.findOneOrThrow(id);
  }

  async resetPassword(id: string, newPassword: string, actorId: string): Promise<void> {
    await this.findStaffOrThrow(id);
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    // Never record the password itself, only that a reset happened — same convention as
    // AuthService.forgotPassword's own "never log the token/secret" rule.
    await this.audit.record({ actorId, action: "STAFF_PASSWORD_RESET", entityType: "User", entityId: id });
  }

  async assignRole(id: string, roleId: string, actorId: string): Promise<StaffUserResponse> {
    await this.findStaffOrThrow(id);
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new DomainException("NOT_FOUND", "Rol topilmadi.");
    const existing = await this.prisma.userRole.findUnique({ where: { userId_roleId: { userId: id, roleId } } });
    if (existing) throw new DomainException("ROLE_ALREADY_ASSIGNED", "Bu rol allaqachon biriktirilgan.");
    await this.prisma.userRole.create({ data: { userId: id, roleId } });
    await this.audit.record({ actorId, action: "STAFF_ROLE_ASSIGNED", entityType: "User", entityId: id, after: { roleId, roleKey: role.key } });
    return this.findOneOrThrow(id);
  }

  async removeRole(id: string, roleId: string, actorId: string): Promise<StaffUserResponse> {
    this.assertNotSelf(id, actorId, "O'zingizdan rolni olib tashlay olmaysiz.");
    const existing = await this.findStaffOrThrow(id);
    const link = await this.prisma.userRole.findUnique({ where: { userId_roleId: { userId: id, roleId } } });
    if (!link) throw new DomainException("ROLE_NOT_ASSIGNED", "Bu rol biriktirilmagan.");
    if (existing.roles.length === 1) {
      throw new DomainException("VALIDATION_ERROR", "Foydalanuvchida kamida bitta rol bo'lishi kerak.");
    }
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id: roleId } });
    await this.prisma.userRole.delete({ where: { userId_roleId: { userId: id, roleId } } });
    await this.audit.record({ actorId, action: "STAFF_ROLE_REMOVED", entityType: "User", entityId: id, before: { roleId, roleKey: role.key } });
    return this.findOneOrThrow(id);
  }
}
