import { Test } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";

describe("UsersService (Admin Operations — Phase 12)", () => {
  let service: UsersService;
  let prisma: {
    user: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    role: { findMany: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    userRole: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
  };
  let audit: { record: jest.Mock };

  const staffRow = (over: Record<string, unknown> = {}) => ({
    id: "user1",
    email: "staff@rosti.uz",
    phone: null,
    displayName: "Staff One",
    status: "ACTIVE",
    lastLoginAt: null,
    createdAt: new Date(),
    roles: [{ role: { id: "role1", key: "manager", name: "Manager" } }],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      role: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      userRole: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    };
    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe("create", () => {
    it("throws VALIDATION_ERROR when neither email nor phone is given", async () => {
      await expect(service.create({ password: "password123", displayName: "X", roleIds: ["role1"] }, "actor1")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws EMAIL_TAKEN when the email is already registered", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: "existing" });
      await expect(
        service.create({ email: "taken@rosti.uz", password: "password123", displayName: "X", roleIds: ["role1"] }, "actor1"),
      ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    });

    it("throws NOT_FOUND when a roleId doesn't exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]);
      await expect(
        service.create({ email: "new@rosti.uz", password: "password123", displayName: "X", roleIds: ["missing"] }, "actor1"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("creates the staff user, hashes the password, and audits it", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: "role1" }]);
      prisma.user.create.mockResolvedValue(staffRow());

      const result = await service.create({ email: "new@rosti.uz", password: "password123", displayName: "Staff One", roleIds: ["role1"] }, "actor1");

      expect(result.email).toBe("staff@rosti.uz");
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe("password123");
      expect(createCall.data.roles).toEqual({ create: [{ roleId: "role1" }] });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_CREATED", actorId: "actor1" }));
    });
  });

  describe("activate / deactivate", () => {
    it("deactivate throws CANNOT_MODIFY_SELF when acting on your own account", async () => {
      await expect(service.deactivate("actor1", "actor1")).rejects.toMatchObject({ code: "CANNOT_MODIFY_SELF" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("deactivate sets status to SUSPENDED and audits it for a different user", async () => {
      prisma.user.findFirst.mockResolvedValue(staffRow());
      await service.deactivate("user1", "actor1");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "SUSPENDED" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_DEACTIVATED" }));
    });

    it("activate sets status to ACTIVE", async () => {
      prisma.user.findFirst.mockResolvedValue(staffRow({ status: "SUSPENDED" }));
      await service.activate("user1", "actor1");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { status: "ACTIVE" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_ACTIVATED" }));
    });

    it("throws NOT_FOUND for a non-staff (roleless) user id", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.activate("nonstaff", "actor1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("resetPassword", () => {
    it("hashes the new password and never records it in the audit entry", async () => {
      prisma.user.findFirst.mockResolvedValue(staffRow());
      await service.resetPassword("user1", "newpassword123", "actor1");
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).not.toBe("newpassword123");
      const auditCall = audit.record.mock.calls[0][0];
      expect(JSON.stringify(auditCall)).not.toContain("newpassword123");
      expect(auditCall.action).toBe("STAFF_PASSWORD_RESET");
    });
  });

  describe("assignRole / removeRole", () => {
    it("assignRole throws ROLE_ALREADY_ASSIGNED if already linked", async () => {
      prisma.user.findFirst.mockResolvedValue(staffRow());
      prisma.role.findUnique.mockResolvedValue({ id: "role2", key: "admin" });
      prisma.userRole.findUnique.mockResolvedValue({ userId: "user1", roleId: "role2" });
      await expect(service.assignRole("user1", "role2", "actor1")).rejects.toMatchObject({ code: "ROLE_ALREADY_ASSIGNED" });
    });

    it("removeRole throws CANNOT_MODIFY_SELF", async () => {
      await expect(service.removeRole("actor1", "role1", "actor1")).rejects.toMatchObject({ code: "CANNOT_MODIFY_SELF" });
    });

    it("removeRole throws VALIDATION_ERROR when it would remove the last role", async () => {
      prisma.user.findFirst.mockResolvedValue(staffRow());
      prisma.userRole.findUnique.mockResolvedValue({ userId: "user1", roleId: "role1" });
      await expect(service.removeRole("user1", "role1", "actor1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });
});
