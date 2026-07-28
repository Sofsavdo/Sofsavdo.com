import { Test } from "@nestjs/testing";
import { RolesService } from "./roles.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";

describe("RolesService — Admin Operations (Phase 12)", () => {
  let service: RolesService;
  let prisma: {
    role: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    permission: { findUnique: jest.Mock };
    rolePermission: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
  };
  let audit: { record: jest.Mock };

  const roleRow = (over: Record<string, unknown> = {}) => ({
    id: "role1",
    key: "manager",
    name: "Manager",
    description: null,
    permissions: [{ permission: { key: "product.read" } }],
    _count: { users: 2 },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      role: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      permission: { findUnique: jest.fn() },
      rolePermission: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    };
    audit = { record: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }],
    }).compile();
    service = moduleRef.get(RolesService);
  });

  describe("createRole", () => {
    it("throws CONFLICT when the key already exists", async () => {
      prisma.role.findUnique.mockResolvedValue({ id: "existing" });
      await expect(service.createRole({ key: "manager", name: "Manager" }, "actor1")).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("creates the role and audits it", async () => {
      prisma.role.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(roleRow({ key: "support", name: "Support" }));
      prisma.role.create.mockResolvedValue({ id: "role2" });
      const result = await service.createRole({ key: "support", name: "Support" }, "actor1");
      expect(result.key).toBe("support");
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ROLE_CREATED" }));
    });
  });

  describe("assignPermission / removePermission", () => {
    it("assignPermission throws NOT_FOUND for an unknown permission key", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow());
      prisma.permission.findUnique.mockResolvedValue(null);
      await expect(service.assignPermission("role1", "product.read", "actor1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("assignPermission throws PERMISSION_ALREADY_ASSIGNED if already linked", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow());
      prisma.permission.findUnique.mockResolvedValue({ id: "perm1", key: "product.read" });
      prisma.rolePermission.findUnique.mockResolvedValue({ roleId: "role1", permissionId: "perm1" });
      await expect(service.assignPermission("role1", "product.read", "actor1")).rejects.toMatchObject({ code: "PERMISSION_ALREADY_ASSIGNED" });
    });

    it("assigns a new permission and audits it", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow());
      prisma.permission.findUnique.mockResolvedValue({ id: "perm2", key: "product.write" });
      prisma.rolePermission.findUnique.mockResolvedValue(null);
      await service.assignPermission("role1", "product.write", "actor1");
      expect(prisma.rolePermission.create).toHaveBeenCalledWith({ data: { roleId: "role1", permissionId: "perm2" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ROLE_PERMISSION_ASSIGNED" }));
    });

    it("removePermission throws VALIDATION_ERROR for a key not in PERMISSIONS at all", async () => {
      await expect(service.removePermission("role1", "not.a.real.key", "actor1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("removePermission throws PERMISSION_NOT_ASSIGNED if not linked", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow());
      prisma.permission.findUnique.mockResolvedValue({ id: "perm1", key: "product.read" });
      prisma.rolePermission.findUnique.mockResolvedValue(null);
      await expect(service.removePermission("role1", "product.read", "actor1")).rejects.toMatchObject({ code: "PERMISSION_NOT_ASSIGNED" });
    });

    it("blocks removing role.manage/user.manage from the seeded super_admin role", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow({ key: "super_admin" }));
      prisma.permission.findUnique.mockResolvedValue({ id: "permX", key: "role.manage" });
      prisma.rolePermission.findUnique.mockResolvedValue({ roleId: "role1", permissionId: "permX" });
      await expect(service.removePermission("role1", "role.manage", "actor1")).rejects.toMatchObject({ code: "CANNOT_MODIFY_SYSTEM_ROLE" });
      expect(prisma.rolePermission.delete).not.toHaveBeenCalled();
    });

    it("allows removing an ordinary permission from super_admin", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow({ key: "super_admin" }));
      prisma.permission.findUnique.mockResolvedValue({ id: "perm1", key: "product.read" });
      prisma.rolePermission.findUnique.mockResolvedValue({ roleId: "role1", permissionId: "perm1" });
      await service.removePermission("role1", "product.read", "actor1");
      expect(prisma.rolePermission.delete).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ROLE_PERMISSION_REMOVED" }));
    });

    it("allows removing role.manage from a non-super_admin role", async () => {
      prisma.role.findUnique.mockResolvedValue(roleRow({ key: "admin" }));
      prisma.permission.findUnique.mockResolvedValue({ id: "permX", key: "role.manage" });
      prisma.rolePermission.findUnique.mockResolvedValue({ roleId: "role1", permissionId: "permX" });
      await service.removePermission("role1", "role.manage", "actor1");
      expect(prisma.rolePermission.delete).toHaveBeenCalled();
    });
  });

  describe("listAllPermissionKeys", () => {
    it("returns the full PERMISSIONS constant", () => {
      const keys = service.listAllPermissionKeys();
      expect(keys).toContain("role.manage");
      expect(keys).toContain("refund.manage");
      expect(keys.length).toBeGreaterThan(60);
    });
  });
});
