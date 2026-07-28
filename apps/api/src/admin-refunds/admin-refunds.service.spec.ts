import { Test } from "@nestjs/testing";
import { AdminRefundsService } from "./admin-refunds.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";

describe("AdminRefundsService (Phase 12)", () => {
  let service: AdminRefundsService;
  let prisma: { refund: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock } };
  let audit: { record: jest.Mock };

  const refundRow = (over: Record<string, unknown> = {}) => ({
    id: "refund1",
    orderId: "order1",
    amountMinor: 50_000,
    reason: "Customer changed mind",
    status: "REQUESTED",
    requestedById: "admin1",
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    processedAt: null,
    createdAt: new Date(),
    order: { publicToken: "tok123", totalMinor: 100_000, offer: { name: "Glow Serum" }, customer: { fullName: "Malika" } },
    ...over,
  });

  beforeEach(async () => {
    prisma = { refund: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    audit = { record: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AdminRefundsService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }],
    }).compile();
    service = moduleRef.get(AdminRefundsService);
  });

  describe("list", () => {
    it("computes isPartial from amountMinor vs. the order's totalMinor", async () => {
      prisma.refund.findMany.mockResolvedValue([refundRow(), refundRow({ id: "refund2", amountMinor: 100_000 })]);
      prisma.refund.count.mockResolvedValue(2);
      const result = await service.list({ page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(result.items[0]!.isPartial).toBe(true);
      expect(result.items[1]!.isPartial).toBe(false);
    });
  });

  describe("findOneOrThrow", () => {
    it("throws NOT_FOUND for a missing id", async () => {
      prisma.refund.findUnique.mockResolvedValue(null);
      await expect(service.findOneOrThrow("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("approve", () => {
    it("transitions REQUESTED -> APPROVED and audits it", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow());
      await service.approve("refund1", "actor1");
      expect(prisma.refund.updateMany).toHaveBeenCalledWith({
        where: { id: "refund1", status: { in: ["REQUESTED"] } },
        data: { status: "APPROVED", reviewedById: "actor1", reviewedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "REFUND_APPROVED" }));
    });

    it("throws INVALID_REFUND_TRANSITION when not REQUESTED", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow({ status: "APPROVED" }));
      await expect(service.approve("refund1", "actor1")).rejects.toMatchObject({ code: "INVALID_REFUND_TRANSITION" });
    });

    it("aborts without auditing when a concurrent request already won the transition (updateMany count 0)", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow());
      prisma.refund.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.approve("refund1", "actor1")).rejects.toMatchObject({ code: "INVALID_REFUND_TRANSITION" });
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    it("transitions REQUESTED -> REJECTED with a reason and audits it", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow());
      await service.reject("refund1", "actor1", "Not eligible after review");
      expect(prisma.refund.updateMany).toHaveBeenCalledWith({
        where: { id: "refund1", status: { in: ["REQUESTED"] } },
        data: { status: "REJECTED", reviewedById: "actor1", reviewedAt: expect.any(Date), rejectionReason: "Not eligible after review" },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "REFUND_REJECTED" }));
    });

    it("throws INVALID_REFUND_TRANSITION when already REJECTED", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow({ status: "REJECTED" }));
      await expect(service.reject("refund1", "actor1", "reason")).rejects.toMatchObject({ code: "INVALID_REFUND_TRANSITION" });
    });

    it("aborts without auditing when a concurrent request already won the transition (updateMany count 0)", async () => {
      prisma.refund.findUnique.mockResolvedValue(refundRow());
      prisma.refund.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.reject("refund1", "actor1", "reason")).rejects.toMatchObject({ code: "INVALID_REFUND_TRANSITION" });
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
