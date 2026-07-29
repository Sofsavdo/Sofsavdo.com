import { Test } from "@nestjs/testing";
import { AuditService } from "./audit.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("AuditService (Phase 12 — general admin audit-log browser)", () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock } };

  const entryRow = (over: Record<string, unknown> = {}) => ({
    id: "log1",
    actorId: "actor1",
    actor: { id: "actor1", email: "admin@sofsavdo.com" },
    action: "STAFF_CREATED",
    entityType: "User",
    entityId: "user1",
    before: null,
    after: { email: "new@sofsavdo.com" },
    createdAt: new Date(),
    ...over,
  });

  beforeEach(async () => {
    prisma = { auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  describe("record", () => {
    it("writes actorId/action/entityType/entityId/before/after", async () => {
      await service.record({ actorId: "actor1", action: "TEST_ACTION", entityType: "Order", entityId: "order1", before: { a: 1 }, after: { a: 2 } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { actorId: "actor1", action: "TEST_ACTION", entityType: "Order", entityId: "order1", before: { a: 1 }, after: { a: 2 } },
      });
    });
  });

  describe("list", () => {
    it("filters by entityType/actorId/action and paginates", async () => {
      prisma.auditLog.findMany.mockResolvedValue([entryRow()]);
      prisma.auditLog.count.mockResolvedValue(1);
      const result = await service.list({ entityType: "User", actorId: "actor1", action: "STAFF_CREATED", page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ entityType: "User", actorId: "actor1", action: "STAFF_CREATED" }) }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("applies a date range filter", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({ dateFrom: "2026-01-01", dateTo: "2026-01-31", page: 1, pageSize: 20, skip: 0, take: 20 });
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date("2026-01-01"));
      expect(where.createdAt.lte).toEqual(new Date("2026-01-31"));
    });

    it("searches by entityId or actor email", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({ search: "user1", page: 1, pageSize: 20, skip: 0, take: 20 });
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ entityId: { contains: "user1", mode: "insensitive" } }, { actor: { email: { contains: "user1", mode: "insensitive" } } }]);
    });
  });

  describe("findOneOrThrow", () => {
    it("throws NOT_FOUND for a missing id", async () => {
      prisma.auditLog.findUnique.mockResolvedValue(null);
      await expect(service.findOneOrThrow("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns the mapped entry including entityType/entityId", async () => {
      prisma.auditLog.findUnique.mockResolvedValue(entryRow());
      const result = await service.findOneOrThrow("log1");
      expect(result).toMatchObject({ id: "log1", entityType: "User", entityId: "user1" });
    });
  });

  describe("listForEntity", () => {
    it("filters by entityType/entityId only", async () => {
      prisma.auditLog.findMany.mockResolvedValue([entryRow()]);
      const result = await service.listForEntity("User", "user1");
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entityType: "User", entityId: "user1" } }));
      expect(result).toHaveLength(1);
    });
  });
});
