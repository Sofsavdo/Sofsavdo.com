import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PayoutsService } from "./payouts.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionsService } from "../commissions/commissions.service";
import { AuditService } from "../common/audit/audit.service";

describe("PayoutsService", () => {
  let service: PayoutsService;
  let prisma: {
    payout: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    payoutMethod: { findUnique: jest.Mock };
    creatorProfile: { findUniqueOrThrow: jest.Mock };
    launchBonus: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: { payout: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock } };
  let commissions: { lockPayableCommissions: jest.Mock; releaseLockedCommissions: jest.Mock; settleLockedCommissions: jest.Mock };
  let audit: { record: jest.Mock };

  const activeMethod = { id: "pm1", creatorId: "creator1", isActive: true, type: "CARD", cardHolder: "Aziz" };

  const fullPayoutLookup = {
    id: "payout1",
    creatorId: "creator1",
    payoutMethodId: "pm1",
    amountMinor: 200_000_00,
    currency: "UZS",
    status: "REQUESTED",
    requestedAt: new Date(),
    reviewedById: null,
    reviewedAt: null,
    paidAt: null,
    rejectionReason: null,
    creator: { id: "creator1", displayName: "Aziz Karimov" },
    payoutMethod: { id: "pm1", type: "CARD", cardHolder: "Aziz", bankName: null },
    commissions: [{ id: "c1", amountMinor: 200_000_00, orderId: "order1" }],
  };

  beforeEach(async () => {
    prisma = {
      payout: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payoutMethod: { findUnique: jest.fn() },
      creatorProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ bioComplianceStatus: "PENDING", tier: "STANDARD" }) },
      launchBonus: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    tx = { payout: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
    commissions = { lockPayableCommissions: jest.fn(), releaseLockedCommissions: jest.fn(), settleLockedCommissions: jest.fn() };
    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 100_000_00 } },
        { provide: CommissionsService, useValue: commissions },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(PayoutsService);
  });

  describe("requestPayout", () => {
    it("rejects a request below the minimum payout amount", async () => {
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 50_000_00, payoutMethodId: "pm1" })).rejects.toMatchObject({ code: "BELOW_MINIMUM" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a payout method belonging to another creator", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue({ ...activeMethod, creatorId: "other" });
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).rejects.toMatchObject({ code: "PAYOUT_METHOD_NOT_FOUND" });
    });

    it("rejects an inactive (removed) payout method", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue({ ...activeMethod, isActive: false });
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).rejects.toMatchObject({ code: "PAYOUT_METHOD_INACTIVE" });
    });

    it("blocks a STANDARD-tier creator marked NON_COMPLIANT", async () => {
      prisma.creatorProfile.findUniqueOrThrow.mockResolvedValue({ bioComplianceStatus: "NON_COMPLIANT", tier: "STANDARD" });
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).rejects.toMatchObject({
        code: "BIO_COMPLIANCE_REQUIRED",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("never blocks a PENDING (never-reviewed) creator", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(activeMethod);
      tx.payout.create.mockResolvedValue({ id: "payout1" });
      prisma.payout.findUnique.mockResolvedValue(fullPayoutLookup);
      prisma.creatorProfile.findUniqueOrThrow.mockResolvedValue({ bioComplianceStatus: "PENDING", tier: "STANDARD" });
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).resolves.toBeDefined();
    });

    it("never blocks a PREMIUM-tier creator, even when NON_COMPLIANT", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(activeMethod);
      tx.payout.create.mockResolvedValue({ id: "payout1" });
      prisma.payout.findUnique.mockResolvedValue(fullPayoutLookup);
      prisma.creatorProfile.findUniqueOrThrow.mockResolvedValue({ bioComplianceStatus: "NON_COMPLIANT", tier: "PREMIUM" });
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).resolves.toBeDefined();
    });

    it("creates a REQUESTED Payout and locks commissions inside the same transaction", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(activeMethod);
      tx.payout.create.mockResolvedValue({ id: "payout1" });
      prisma.payout.findUnique.mockResolvedValue(fullPayoutLookup);

      await service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" });

      expect(tx.payout.create).toHaveBeenCalledWith({ data: { creatorId: "creator1", payoutMethodId: "pm1", amountMinor: 200_000_00, status: "REQUESTED" } });
      expect(commissions.lockPayableCommissions).toHaveBeenCalledWith(tx, "creator1", 200_000_00, "payout1", 0);
    });

    it("propagates INSUFFICIENT_BALANCE from lockPayableCommissions, rolling back the Payout row", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(activeMethod);
      tx.payout.create.mockResolvedValue({ id: "payout1" });
      commissions.lockPayableCommissions.mockRejectedValue(Object.assign(new Error("insufficient"), { code: "INSUFFICIENT_BALANCE" }));
      await expect(service.requestPayout("creator1", "user1", { amountMinor: 200_000_00, payoutMethodId: "pm1" })).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });
  });

  describe("cancel", () => {
    it("releases locked commissions and transitions REQUESTED -> CANCELLED", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", creatorId: "creator1", status: "REQUESTED" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "CANCELLED" });
      await service.cancel("payout1", "creator1", "user1");
      expect(tx.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["REQUESTED"] } }, data: { status: "CANCELLED" } });
      expect(commissions.releaseLockedCommissions).toHaveBeenCalledWith(tx, "payout1");
    });

    it("rejects cancelling another creator's payout (no id-guessing oracle)", async () => {
      prisma.payout.findUnique.mockResolvedValue({ id: "payout1", creatorId: "other-creator", status: "REQUESTED" });
      await expect(service.cancel("payout1", "creator1", "user1")).rejects.toMatchObject({ code: "PAYOUT_NOT_FOUND" });
    });

    it("rejects cancelling a payout that's already APPROVED", async () => {
      prisma.payout.findUnique.mockResolvedValue({ id: "payout1", creatorId: "creator1", status: "APPROVED" });
      await expect(service.cancel("payout1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    });

    it("aborts without releasing commissions when a concurrent request already won the transition", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", creatorId: "creator1", status: "REQUESTED" });
      tx.payout.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.cancel("payout1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
      expect(commissions.releaseLockedCommissions).not.toHaveBeenCalled();
    });
  });

  describe("admin: approve / reject / markProcessing / markPaid / markFailed", () => {
    it("approves a REQUESTED payout", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "REQUESTED" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "APPROVED" });
      await service.approve("payout1", "admin1");
      expect(prisma.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["REQUESTED"] } }, data: { status: "APPROVED", reviewedById: "admin1", reviewedAt: expect.any(Date) } });
    });

    it("rejects approving a non-REQUESTED payout", async () => {
      prisma.payout.findUnique.mockResolvedValue({ id: "payout1", status: "PAID" });
      await expect(service.approve("payout1", "admin1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    });

    it("rejects approve when a concurrent request already won the transition (updateMany count 0)", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "REQUESTED" });
      prisma.payout.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.approve("payout1", "admin1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    });

    it("rejects a payout (from REQUESTED or APPROVED) and releases its locked commissions", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "APPROVED" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "REJECTED" });
      await service.reject("payout1", "admin1", "Suspicious activity");
      expect(tx.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["REQUESTED", "APPROVED"] } }, data: { status: "REJECTED", reviewedById: "admin1", reviewedAt: expect.any(Date), rejectionReason: "Suspicious activity" } });
      expect(commissions.releaseLockedCommissions).toHaveBeenCalledWith(tx, "payout1");
    });

    it("aborts reject without releasing commissions when a concurrent request already won the transition", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "APPROVED" });
      tx.payout.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.reject("payout1", "admin1", "Suspicious activity")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
      expect(commissions.releaseLockedCommissions).not.toHaveBeenCalled();
    });

    it("marks an APPROVED payout PROCESSING", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "APPROVED" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "PROCESSING" });
      await service.markProcessing("payout1", "admin1");
      expect(prisma.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["APPROVED"] } }, data: { status: "PROCESSING" } });
    });

    it("rejects marking PROCESSING directly from REQUESTED", async () => {
      prisma.payout.findUnique.mockResolvedValue({ id: "payout1", status: "REQUESTED" });
      await expect(service.markProcessing("payout1", "admin1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    });

    it("marks a PROCESSING payout PAID and settles its locked commissions", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "PROCESSING" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "PAID" });
      await service.markPaid("payout1", "admin1");
      expect(tx.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["PROCESSING"] } }, data: { status: "PAID", paidAt: expect.any(Date) } });
      expect(commissions.settleLockedCommissions).toHaveBeenCalledWith(tx, "payout1");
    });

    it("marks a PROCESSING payout FAILED and releases its locked commissions back to available", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "PROCESSING" }).mockResolvedValueOnce({ ...fullPayoutLookup, status: "FAILED" });
      await service.markFailed("payout1", "admin1", "Bank rejected the transfer");
      expect(tx.payout.updateMany).toHaveBeenCalledWith({ where: { id: "payout1", status: { in: ["PROCESSING"] } }, data: { status: "FAILED", rejectionReason: "Bank rejected the transfer" } });
      expect(commissions.releaseLockedCommissions).toHaveBeenCalledWith(tx, "payout1");
    });

    it("rejects marking PAID directly from REQUESTED (must go through the full workflow)", async () => {
      prisma.payout.findUnique.mockResolvedValue({ id: "payout1", status: "REQUESTED" });
      await expect(service.markPaid("payout1", "admin1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
    });

    it("never double-settles commissions: a concurrent markPaid call that loses the race aborts before touching CommissionsService", async () => {
      prisma.payout.findUnique.mockResolvedValueOnce({ id: "payout1", status: "PROCESSING" });
      tx.payout.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.markPaid("payout1", "admin1")).rejects.toMatchObject({ code: "INVALID_PAYOUT_TRANSITION" });
      expect(commissions.settleLockedCommissions).not.toHaveBeenCalled();
    });
  });
});
