import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CommissionsService } from "./commissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";

describe("CommissionsService", () => {
  let service: CommissionsService;
  let prisma: {
    commission: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
    commissionLedger: { findMany: jest.Mock; create: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: { commission: { update: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock }; commissionLedger: { create: jest.Mock } };
  let audit: { record: jest.Mock };

  const baseCommission = {
    id: "commission1",
    orderId: "order1",
    creatorId: "creator1",
    commissionRuleId: "rule1",
    baseAmountMinor: 100_000_00,
    amountMinor: 10_000_00,
    currency: "UZS",
    status: "PENDING" as const,
    approvedAt: null,
    payableAt: null,
    paidAt: null,
    payoutId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fullCommissionLookup = {
    ...baseCommission,
    order: { id: "order1", publicToken: "public-token-1" },
    creator: { id: "creator1", displayName: "Malika Yusupova" },
    commissionRule: { id: "rule1", commissionType: "PERCENTAGE", campaign: { id: "campaign1", name: "Yoz kampaniyasi" } },
    ledgerEntries: [],
  };

  beforeEach(async () => {
    prisma = {
      commission: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
      commissionLedger: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(),
    };
    tx = { commission: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn() }, commissionLedger: { create: jest.fn() } };
    // Array-form $transaction([...]) calls the outer prisma client directly (each element is
    // already a promise from e.g. `this.prisma.commission.update(...)`), unlike the callback form
    // `$transaction(async (tx) => ...)` used everywhere else in this service, which gets the
    // tx-scoped mock instead.
    prisma.$transaction.mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: unknown) => unknown)(tx);
    });
    prisma.commission.findMany.mockResolvedValue([]); // no stale refunded orders by default

    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 100_000_00 } },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(CommissionsService);
  });

  describe("approve", () => {
    it("transitions PENDING -> APPROVED and writes an ACCRUAL ledger entry", async () => {
      prisma.commission.findUnique.mockResolvedValueOnce(baseCommission).mockResolvedValueOnce(fullCommissionLookup);
      await service.approve("commission1", "admin1");
      expect(tx.commission.updateMany).toHaveBeenCalledWith({ where: { id: "commission1", status: { in: ["PENDING"] } }, data: { status: "APPROVED", approvedAt: expect.any(Date) } });
      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "commission1", type: "ACCRUAL", amountMinor: 10_000_00 } });
    });

    it("rejects approving an already-APPROVED commission", async () => {
      prisma.commission.findUnique.mockResolvedValue({ ...baseCommission, status: "APPROVED" });
      await expect(service.approve("commission1", "admin1")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
    });

    it("aborts without writing a ledger entry when a concurrent request already won the transition (updateMany count 0)", async () => {
      prisma.commission.findUnique.mockResolvedValueOnce(baseCommission).mockResolvedValueOnce(fullCommissionLookup);
      tx.commission.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.approve("commission1", "admin1")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
      expect(tx.commissionLedger.create).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    it("rejects a PENDING commission with no ledger reversal (nothing was ever accrued)", async () => {
      prisma.commission.findUnique.mockResolvedValueOnce(baseCommission).mockResolvedValueOnce(fullCommissionLookup);
      await service.reject("commission1", "admin1", "Fraudulent order");
      expect(tx.commissionLedger.create).not.toHaveBeenCalled();
      expect(tx.commission.updateMany).toHaveBeenCalledWith({ where: { id: "commission1", status: { in: ["PENDING", "APPROVED"] } }, data: { status: "REJECTED" } });
    });

    it("writes a REVERSAL entry when rejecting an already-APPROVED commission", async () => {
      const approved = { ...baseCommission, status: "APPROVED" as const };
      prisma.commission.findUnique.mockResolvedValueOnce(approved).mockResolvedValueOnce({ ...fullCommissionLookup, status: "REJECTED" });
      await service.reject("commission1", "admin1", "Chargeback");
      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "commission1", type: "REVERSAL", amountMinor: -10_000_00, reason: "Chargeback" } });
    });

    it("rejects rejecting an already-PAID commission", async () => {
      prisma.commission.findUnique.mockResolvedValue({ ...baseCommission, status: "PAID" });
      await expect(service.reject("commission1", "admin1", "too late")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
    });

    it("aborts without a REVERSAL write when a concurrent request already won the transition", async () => {
      const approved = { ...baseCommission, status: "APPROVED" as const };
      prisma.commission.findUnique.mockResolvedValueOnce(approved).mockResolvedValueOnce({ ...fullCommissionLookup, status: "REJECTED" });
      tx.commission.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.reject("commission1", "admin1", "Chargeback")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
      expect(tx.commissionLedger.create).not.toHaveBeenCalled();
    });
  });

  describe("markPayable", () => {
    it("transitions APPROVED -> PAYABLE with no ledger entry", async () => {
      prisma.commission.findUnique.mockResolvedValueOnce({ ...baseCommission, status: "APPROVED" }).mockResolvedValueOnce({ ...fullCommissionLookup, status: "PAYABLE" });
      prisma.commission.updateMany.mockResolvedValueOnce({ count: 1 });
      await service.markPayable("commission1", "admin1");
      expect(prisma.commission.updateMany).toHaveBeenCalledWith({ where: { id: "commission1", status: { in: ["APPROVED"] } }, data: { status: "PAYABLE", payableAt: expect.any(Date) } });
      expect(prisma.commission.count).not.toHaveBeenCalled(); // sanity: no side calls
    });

    it("rejects marking a PENDING commission payable directly", async () => {
      prisma.commission.findUnique.mockResolvedValue(baseCommission);
      await expect(service.markPayable("commission1", "admin1")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
    });

    it("rejects when a concurrent request already won the transition (updateMany count 0)", async () => {
      prisma.commission.findUnique.mockResolvedValueOnce({ ...baseCommission, status: "APPROVED" });
      prisma.commission.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.markPayable("commission1", "admin1")).rejects.toMatchObject({ code: "INVALID_COMMISSION_TRANSITION" });
    });
  });

  describe("getWalletBalance", () => {
    it("aggregates pending/available/locked/paid/reversed from Commission + CommissionLedger", async () => {
      prisma.commission.groupBy.mockResolvedValue([
        { status: "PENDING", _sum: { amountMinor: 10_000_00 } },
        { status: "APPROVED", _sum: { amountMinor: 20_000_00 } },
        { status: "PAID", _sum: { amountMinor: 30_000_00 } },
        { status: "REJECTED", _sum: { amountMinor: 5_000_00 } },
        { status: "REFUNDED", _sum: { amountMinor: 7_000_00 } },
        { status: "DONATED", _sum: { amountMinor: 8_000_00 } },
      ]);
      prisma.commission.aggregate.mockResolvedValueOnce({ _sum: { amountMinor: 15_000_00 } }).mockResolvedValueOnce({ _sum: { amountMinor: 40_000_00 } });

      const balance = await service.getWalletBalance("creator1");

      expect(balance).toMatchObject({
        pendingMinor: 30_000_00, // PENDING + APPROVED
        lockedMinor: 15_000_00,
        availableMinor: 40_000_00,
        paidMinor: 30_000_00,
        reversedMinor: 12_000_00, // REJECTED + REFUNDED
        donatedMinor: 8_000_00,
        minimumPayoutMinor: 100_000_00,
      });
    });

    it("defaults every bucket to 0 when a creator has no commissions at all", async () => {
      prisma.commission.groupBy.mockResolvedValue([]);
      prisma.commission.aggregate.mockResolvedValue({ _sum: { amountMinor: null } });
      const balance = await service.getWalletBalance("creator-new");
      expect(balance).toMatchObject({ pendingMinor: 0, availableMinor: 0, lockedMinor: 0, paidMinor: 0, reversedMinor: 0, donatedMinor: 0 });
    });
  });

  describe("reconcileRefundedOrders (lazy sweep)", () => {
    it("reverses an APPROVED commission whose order was refunded, writing a REVERSAL entry", async () => {
      prisma.commission.findMany.mockResolvedValueOnce([{ id: "commission1", status: "APPROVED", amountMinor: 10_000_00 }]);
      prisma.commission.aggregate.mockResolvedValue({ _sum: { amountMinor: 0 } });
      prisma.commission.groupBy.mockResolvedValue([]);

      await service.getWalletBalance("creator1");

      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "commission1", type: "REVERSAL", amountMinor: -10_000_00, reason: "Order refunded" } });
      expect(tx.commission.update).toHaveBeenCalledWith({ where: { id: "commission1" }, data: { status: "REFUNDED" } });
    });

    it("reverses a still-PENDING commission with no ledger entry (nothing to reverse)", async () => {
      prisma.commission.findMany.mockResolvedValueOnce([{ id: "commission2", status: "PENDING", amountMinor: 5_000_00 }]);
      prisma.commission.aggregate.mockResolvedValue({ _sum: { amountMinor: 0 } });
      prisma.commission.groupBy.mockResolvedValue([]);

      await service.getWalletBalance("creator1");

      expect(tx.commissionLedger.create).not.toHaveBeenCalled();
      expect(tx.commission.update).toHaveBeenCalledWith({ where: { id: "commission2" }, data: { status: "REFUNDED" } });
    });

    it("never touches a commission already locked into an in-flight payout", async () => {
      // The sweep's own query filters payoutId: null — verify the where clause carries that guard.
      prisma.commission.aggregate.mockResolvedValue({ _sum: { amountMinor: 0 } });
      prisma.commission.groupBy.mockResolvedValue([]);
      await service.getWalletBalance("creator1");
      expect(prisma.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ payoutId: null, order: { status: "REFUNDED" } }) }),
      );
    });
  });

  describe("lockPayableCommissions", () => {
    it("locks the oldest PAYABLE commissions up to the requested amount", async () => {
      tx.commission.findMany.mockResolvedValue([
        { id: "c1", amountMinor: 5_000_00 },
        { id: "c2", amountMinor: 5_000_00 },
        { id: "c3", amountMinor: 5_000_00 },
      ]);
      tx.commission.updateMany.mockResolvedValue({ count: 2 });
      await service.lockPayableCommissions(tx as never, "creator1", 10_000_00, "payout1");
      expect(tx.commission.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["c1", "c2"] }, payoutId: null }, data: { payoutId: "payout1" } });
    });

    it("throws INSUFFICIENT_BALANCE when PAYABLE commissions don't cover the requested amount", async () => {
      tx.commission.findMany.mockResolvedValue([{ id: "c1", amountMinor: 5_000_00 }]);
      await expect(service.lockPayableCommissions(tx as never, "creator1", 10_000_00, "payout1")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });

    it("throws INSUFFICIENT_BALANCE when a concurrent request already locked one of the selected rows", async () => {
      tx.commission.findMany.mockResolvedValue([
        { id: "c1", amountMinor: 5_000_00 },
        { id: "c2", amountMinor: 5_000_00 },
      ]);
      // Only 1 of the 2 rows we intended to lock still had payoutId: null by the time our UPDATE ran.
      tx.commission.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.lockPayableCommissions(tx as never, "creator1", 10_000_00, "payout1")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });
  });

  describe("contributeToFund", () => {
    it("locks the oldest PAYABLE/unlocked commissions up to the requested amount, marks them DONATED, and writes a DONATION ledger entry each", async () => {
      tx.commission.findMany.mockResolvedValue([
        { id: "c1", amountMinor: 5_000_00 },
        { id: "c2", amountMinor: 5_000_00 },
        { id: "c3", amountMinor: 5_000_00 },
      ]);
      tx.commission.updateMany.mockResolvedValue({ count: 2 });
      await service.contributeToFund(tx as never, "creator1", 10_000_00, "fund1");
      expect(tx.commission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { creatorId: "creator1", status: "PAYABLE", payoutId: null, fundContributionId: null } }));
      expect(tx.commission.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["c1", "c2"] }, payoutId: null, fundContributionId: null },
        data: { status: "DONATED", donatedAt: expect.any(Date), fundContributionId: "fund1" },
      });
      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "c1", type: "DONATION", amountMinor: -5_000_00, reason: "Creator Fund contribution fund1" } });
      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "c2", type: "DONATION", amountMinor: -5_000_00, reason: "Creator Fund contribution fund1" } });
    });

    it("throws INSUFFICIENT_BALANCE when PAYABLE commissions don't cover the requested amount", async () => {
      tx.commission.findMany.mockResolvedValue([{ id: "c1", amountMinor: 5_000_00 }]);
      await expect(service.contributeToFund(tx as never, "creator1", 10_000_00, "fund1")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });

    it("throws INSUFFICIENT_BALANCE when a concurrent request already claimed one of the selected rows", async () => {
      tx.commission.findMany.mockResolvedValue([
        { id: "c1", amountMinor: 5_000_00 },
        { id: "c2", amountMinor: 5_000_00 },
      ]);
      tx.commission.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.contributeToFund(tx as never, "creator1", 10_000_00, "fund1")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    });
  });

  describe("settleLockedCommissions / releaseLockedCommissions", () => {
    it("settles every locked commission to PAID with a PAYOUT ledger entry each", async () => {
      tx.commission.findMany.mockResolvedValue([{ id: "c1", amountMinor: 5_000_00 }, { id: "c2", amountMinor: 5_000_00 }]);
      await service.settleLockedCommissions(tx as never, "payout1");
      expect(tx.commission.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "PAID", paidAt: expect.any(Date) } });
      expect(tx.commissionLedger.create).toHaveBeenCalledWith({ data: { commissionId: "c1", type: "PAYOUT", amountMinor: -5_000_00, reason: "Payout payout1" } });
    });

    it("releases locked commissions back to unlocked PAYABLE with no ledger entry", async () => {
      await service.releaseLockedCommissions(tx as never, "payout1");
      expect(tx.commission.updateMany).toHaveBeenCalledWith({ where: { payoutId: "payout1" }, data: { payoutId: null } });
    });
  });

  describe("listMySales", () => {
    const row = {
      id: "commission1",
      baseAmountMinor: 90_000_00,
      amountMinor: 18_000_00,
      order: {
        publicToken: "public-token-1",
        status: "DELIVERED",
        createdAt: new Date("2026-01-15"),
        subtotalMinor: 100_000_00,
        discountMinor: 10_000_00,
        customer: { fullName: "Aziz Karimov", phone: "+998901234512" },
        offer: { name: "Glow Serum" },
        attribution: { source: "PROMO_CODE" },
      },
      commissionRule: { campaign: { name: "Yoz kampaniyasi" } },
    };

    it("scopes to the given creator, orders by newest first, and masks customer PII", async () => {
      prisma.commission.findMany.mockResolvedValueOnce([row]);
      const result = await service.listMySales("creator1");
      expect(prisma.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { creatorId: "creator1" }, orderBy: { createdAt: "desc" } }),
      );
      expect(result).toEqual([
        {
          id: "commission1",
          orderPublicToken: "public-token-1",
          createdAt: row.order.createdAt,
          campaignName: "Yoz kampaniyasi",
          offerName: "Glow Serum",
          customerMasked: "A. Karimov, +998 90 *** ** 12",
          amountMinor: 100_000_00,
          discountMinor: 10_000_00,
          commissionBaseMinor: 90_000_00,
          commissionMinor: 18_000_00,
          orderStatus: "DELIVERED",
          attributionSource: "PROMO_CODE",
        },
      ]);
    });

    it("caps the query at the fixed per-request limit rather than paginating", async () => {
      prisma.commission.findMany.mockResolvedValueOnce([]);
      await service.listMySales("creator1");
      expect(prisma.commission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    });

    it("falls back to REFERRAL_VISIT if a row somehow has no attribution (defensive, should not happen)", async () => {
      prisma.commission.findMany.mockResolvedValueOnce([{ ...row, order: { ...row.order, attribution: null } }]);
      const [result] = await service.listMySales("creator1");
      expect(result!.attributionSource).toBe("REFERRAL_VISIT");
    });
  });

  describe("listMyCommissions", () => {
    const row = {
      id: "commission1",
      baseAmountMinor: 90_000_00,
      amountMinor: 18_000_00,
      currency: "UZS",
      status: "APPROVED" as const,
      createdAt: new Date("2026-01-15"),
      order: { publicToken: "public-token-1" },
      commissionRule: { commissionType: "PERCENTAGE", campaign: { name: "Yoz kampaniyasi" } },
    };

    it("scopes to the given creator, orders by newest first, and exposes the real Commission.status", async () => {
      // First findMany call is reconcileRefundedOrders' own stale-order sweep (no stale rows here);
      // the second is the real listing this method returns.
      prisma.commission.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
      const result = await service.listMyCommissions("creator1");
      expect(prisma.commission.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { creatorId: "creator1" }, orderBy: { createdAt: "desc" }, take: 200 }),
      );
      expect(result).toEqual([
        {
          id: "commission1",
          orderPublicToken: "public-token-1",
          campaignName: "Yoz kampaniyasi",
          commissionType: "PERCENTAGE",
          baseAmountMinor: 90_000_00,
          amountMinor: 18_000_00,
          currency: "UZS",
          status: "APPROVED",
          createdAt: row.createdAt,
        },
      ]);
    });
  });
});
