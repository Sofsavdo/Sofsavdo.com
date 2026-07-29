import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { NotificationSweepService } from "./notification-sweep.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationSweepService", () => {
  let service: NotificationSweepService;
  let prisma: { order: { findMany: jest.Mock }; payment: { findMany: jest.Mock }; commission: { findMany: jest.Mock }; payout: { findMany: jest.Mock } };
  let notifications: { dispatchToCreator: jest.Mock; dispatchToAdmins: jest.Mock };
  let schedulerRegistry: { deleteInterval: jest.Mock };

  async function build(nodeEnv: string) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationSweepService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: { get: () => nodeEnv } },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
      ],
    }).compile();
    // .compile() alone does not run lifecycle hooks — .init() is what actually invokes
    // onModuleInit(), exactly like app.init() does for the real application.
    await moduleRef.init();
    return moduleRef.get(NotificationSweepService);
  }

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      commission: { findMany: jest.fn().mockResolvedValue([]) },
      payout: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { dispatchToCreator: jest.fn(), dispatchToAdmins: jest.fn() };
    schedulerRegistry = { deleteInterval: jest.fn() };
    // "development", not "test" — these tests exercise the real sweep logic via a direct .sweep()
    // call, exactly like notifications.e2e-spec.ts does. The onModuleInit guard (removing the
    // underlying @Interval timer, not short-circuiting sweep() itself) has its own tests below —
    // a body-level nodeEnv check would have also silently blocked those legitimate direct calls,
    // which is the exact regression this split (onModuleInit vs. sweep()) fixes.
    service = await build("development");
  });

  it("does not touch the scheduler when nodeEnv is not \"test\" — the real @Interval keeps running in production/development", async () => {
    expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
  });

  it("deletes the notification-sweep interval via SchedulerRegistry on init when nodeEnv is \"test\" — this is what actually stops the timer from keeping the process alive, not a body-level early return", async () => {
    await build("test");
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith("notification-sweep");
  });

  it("still runs the real sweep logic when sweep() is called directly in a test env (e.g. from an e2e test) — only the automatic timer is disabled, never manual invocation", async () => {
    const testEnvService = await build("test");
    await testEnvService.sweep();
    expect(prisma.order.findMany).toHaveBeenCalled();
    expect(prisma.payment.findMany).toHaveBeenCalled();
    expect(prisma.commission.findMany).toHaveBeenCalled();
    expect(prisma.payout.findMany).toHaveBeenCalled();
  });

  it("dispatches order.received for a PAID order with an attribution, keyed by orderId", async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: "o1", status: "PAID", publicToken: "TOK1", totalMinor: 5000, currency: "UZS", offer: { name: "Serum" }, attribution: { creatorId: "c1" } },
    ]);
    await service.sweep();
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith(
      "c1",
      "order.received",
      { offerName: "Serum", amountMinor: 5000, currency: "UZS", orderPublicToken: "TOK1" },
      "order.received:o1",
    );
  });

  it("dispatches order.delivered for a DELIVERED order", async () => {
    prisma.order.findMany.mockResolvedValue([{ id: "o2", status: "DELIVERED", publicToken: "TOK2", totalMinor: 5000, currency: "UZS", offer: { name: "Serum" }, attribution: { creatorId: "c1" } }]);
    await service.sweep();
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith("c1", "order.delivered", { offerName: "Serum", orderPublicToken: "TOK2" }, "order.delivered:o2");
  });

  it("skips an order with no attribution — nothing to notify a creator about", async () => {
    prisma.order.findMany.mockResolvedValue([{ id: "o3", status: "PAID", publicToken: "TOK3", totalMinor: 5000, currency: "UZS", offer: { name: "Serum" }, attribution: null }]);
    await service.sweep();
    expect(notifications.dispatchToCreator).not.toHaveBeenCalled();
  });

  it("notifies admins of a FAILED payment", async () => {
    prisma.payment.findMany.mockResolvedValue([{ id: "pay1", provider: "CLICK", amountMinor: 1000, currency: "UZS", order: { publicToken: "TOK1" } }]);
    await service.sweep();
    expect(notifications.dispatchToAdmins).toHaveBeenCalledWith(
      "payment.failed.admin",
      { orderPublicToken: "TOK1", amountMinor: 1000, currency: "UZS", provider: "CLICK" },
      "payment.failed.admin:pay1",
    );
  });

  it("dispatches commission.approved and commission.payable by status", async () => {
    prisma.commission.findMany.mockResolvedValue([
      { id: "c1", status: "APPROVED", creatorId: "creator1", amountMinor: 1000, currency: "UZS" },
      { id: "c2", status: "PAYABLE", creatorId: "creator1", amountMinor: 2000, currency: "UZS" },
    ]);
    await service.sweep();
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith("creator1", "commission.approved", { amountMinor: 1000, currency: "UZS" }, "commission.approved:c1");
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith("creator1", "commission.payable", { amountMinor: 2000, currency: "UZS" }, "commission.payable:c2");
  });

  it("dispatches both creator and admin notifications for a REQUESTED payout", async () => {
    prisma.payout.findMany.mockResolvedValue([
      { id: "p1", status: "REQUESTED", creatorId: "creator1", amountMinor: 100_000_00, currency: "UZS", rejectionReason: null, creator: { displayName: "Malika" } },
    ]);
    await service.sweep();
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith("creator1", "payout.requested", { amountMinor: 100_000_00, currency: "UZS" }, "payout.requested:p1");
    expect(notifications.dispatchToAdmins).toHaveBeenCalledWith(
      "payout.requested.admin",
      { amountMinor: 100_000_00, currency: "UZS", creatorName: "Malika" },
      "payout.requested.admin:p1",
    );
  });

  it("dispatches payout.rejected with the rejection reason", async () => {
    prisma.payout.findMany.mockResolvedValue([
      { id: "p2", status: "REJECTED", creatorId: "creator1", amountMinor: 50_000_00, currency: "UZS", rejectionReason: "Shubhali faoliyat", creator: { displayName: "Malika" } },
    ]);
    await service.sweep();
    expect(notifications.dispatchToCreator).toHaveBeenCalledWith(
      "creator1",
      "payout.rejected",
      { amountMinor: 50_000_00, currency: "UZS", reason: "Shubhali faoliyat" },
      "payout.rejected:p2",
    );
  });

  it("notifies admins (not the creator) of a FAILED payout", async () => {
    prisma.payout.findMany.mockResolvedValue([
      { id: "p3", status: "FAILED", creatorId: "creator1", amountMinor: 50_000_00, currency: "UZS", rejectionReason: "Bank rad etdi", creator: { displayName: "Malika" } },
    ]);
    await service.sweep();
    expect(notifications.dispatchToAdmins).toHaveBeenCalledWith(
      "payout.failed.admin",
      { amountMinor: 50_000_00, currency: "UZS", creatorName: "Malika", reason: "Bank rad etdi" },
      "payout.failed.admin:p3",
    );
    expect(notifications.dispatchToCreator).not.toHaveBeenCalledWith("creator1", expect.stringContaining("failed"), expect.anything(), expect.anything());
  });

  describe("time-bounded sweep (launch-readiness fix — unbounded terminal-status scans)", () => {
    it("bounds every sweep query by a recent updatedAt cutoff, not just status", async () => {
      await service.sweep();
      for (const mock of [prisma.order.findMany, prisma.payment.findMany, prisma.commission.findMany, prisma.payout.findMany]) {
        const { where } = mock.mock.calls[0][0];
        expect(where.updatedAt.gte).toBeInstanceOf(Date);
      }
    });
  });

  describe("heartbeat and reentrancy (Phase 14 §10 — jobs must be observable and must not overlap)", () => {
    it("starts with no heartbeat, then records lastRunAt after a successful sweep", async () => {
      expect(service.getHeartbeat()).toEqual({ lastRunAt: null, lastError: null });
      await service.sweep();
      const heartbeat = service.getHeartbeat();
      expect(heartbeat.lastRunAt).toBeInstanceOf(Date);
      expect(heartbeat.lastError).toBeNull();
    });

    it("records lastError and rethrows when a sweep fails, without setting lastRunAt", async () => {
      prisma.order.findMany.mockRejectedValue(new Error("db exploded"));
      await expect(service.sweep()).rejects.toThrow("db exploded");
      const heartbeat = service.getHeartbeat();
      expect(heartbeat.lastRunAt).toBeNull();
      expect(heartbeat.lastError).toBe("db exploded");
    });

    it("skips a concurrent sweep() call while the previous one is still in flight, instead of querying twice", async () => {
      let resolveOrders!: (rows: unknown[]) => void;
      prisma.order.findMany.mockReturnValue(new Promise((resolve) => { resolveOrders = resolve; }));
      const firstCall = service.sweep();
      const secondCall = service.sweep();
      expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
      resolveOrders([]);
      await Promise.all([firstCall, secondCall]);
      expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    });

    it("allows a fresh sweep() after the previous one has finished", async () => {
      await service.sweep();
      await service.sweep();
      expect(prisma.order.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
