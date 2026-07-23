import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AuditService } from "../common/audit/audit.service";
import { PAYMENT_PORT } from "./payment.port";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let prisma: { order: { findUniqueOrThrow: jest.Mock }; payment: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let orders: { transitionStatus: jest.Mock; markPaid: jest.Mock; markPaymentFailed: jest.Mock };
  let audit: { record: jest.Mock };
  let paymentPort: { createPayment: jest.Mock; verifyCallback: jest.Mock; buildCallbackReply: jest.Mock };

  const order = { id: "order1", status: "CREATED", totalMinor: 150_000_00, currency: "UZS", publicToken: "public1" };

  beforeEach(async () => {
    prisma = { order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) }, payment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    orders = { transitionStatus: jest.fn(), markPaid: jest.fn(), markPaymentFailed: jest.fn() };
    audit = { record: jest.fn() };
    paymentPort = { createPayment: jest.fn().mockResolvedValue({ redirectUrl: "https://my.click.uz/services/pay?x=1" }), verifyCallback: jest.fn(), buildCallbackReply: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => "http://localhost:3000" } },
        { provide: OrdersService, useValue: orders },
        { provide: AuditService, useValue: audit },
        { provide: PAYMENT_PORT, useValue: paymentPort },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  describe("initiatePayment", () => {
    it("creates a Payment row and calls the port for CLICK, returning a redirect URL", async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue({ id: "payment1" });
      const result = await service.initiatePayment("order1", "CLICK");
      expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "CLICK", amountMinor: 150_000_00, status: "PENDING" }) }));
      expect(paymentPort.createPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "payment1", amountMinor: 150_000_00 }));
      expect(result.redirectUrl).toBe("https://my.click.uz/services/pay?x=1");
      expect(orders.transitionStatus).toHaveBeenCalledWith("order1", "PAYMENT_PENDING", null, undefined);
    });

    it("never calls the payment port for MANUAL (Pay Later) and returns no redirect", async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue({ id: "payment2" });
      const result = await service.initiatePayment("order1", "MANUAL");
      expect(paymentPort.createPayment).not.toHaveBeenCalled();
      expect(result.redirectUrl).toBeNull();
    });

    it("reuses an existing Payment row instead of creating a second one on retry", async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1" });
      await service.initiatePayment("order1", "CLICK");
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe("handleClickCallback", () => {
    const verifiedBase = { action: "COMPLETE" as const, paymentId: "payment1", providerTransactionId: "555", amountMinor: 150_000_00, errorCode: null, errorNote: null };

    it("throws PAYMENT_NOT_FOUND when the payment doesn't exist", async () => {
      paymentPort.verifyCallback.mockReturnValue(verifiedBase);
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.handleClickCallback({})).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    });

    it("throws INVALID_PAYMENT_AMOUNT when the callback amount doesn't match the stored Payment", async () => {
      paymentPort.verifyCallback.mockReturnValue(verifiedBase);
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1", orderId: "order1", amountMinor: 999_00, status: "PENDING" });
      await expect(service.handleClickCallback({})).rejects.toMatchObject({ code: "INVALID_PAYMENT_AMOUNT" });
    });

    it("marks the Payment PAID and calls OrdersService.markPaid on a successful COMPLETE", async () => {
      paymentPort.verifyCallback.mockReturnValue(verifiedBase);
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1", orderId: "order1", amountMinor: 150_000_00, status: "PENDING" });
      await service.handleClickCallback({ click_trans_id: "555" });
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAID", providerReference: "555" }) }));
      expect(orders.markPaid).toHaveBeenCalledWith("order1");
    });

    it("marks the Payment FAILED and calls markPaymentFailed when the provider reports an error", async () => {
      paymentPort.verifyCallback.mockReturnValue({ ...verifiedBase, errorCode: -9, errorNote: "cancelled" });
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1", orderId: "order1", amountMinor: 150_000_00, status: "PENDING" });
      await service.handleClickCallback({});
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
      expect(orders.markPaymentFailed).toHaveBeenCalledWith("order1", "cancelled");
    });

    it("does not reprocess a callback for an already-terminal Payment (replay protection)", async () => {
      paymentPort.verifyCallback.mockReturnValue(verifiedBase);
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1", orderId: "order1", amountMinor: 150_000_00, status: "PAID" });
      const result = await service.handleClickCallback({});
      expect(result.alreadyProcessed).toBe(true);
      expect(orders.markPaid).not.toHaveBeenCalled();
    });

    it("only stores providerReference (no status change) on a successful PREPARE", async () => {
      paymentPort.verifyCallback.mockReturnValue({ ...verifiedBase, action: "PREPARE" });
      prisma.payment.findUnique.mockResolvedValue({ id: "payment1", orderId: "order1", amountMinor: 150_000_00, status: "PENDING" });
      await service.handleClickCallback({});
      expect(prisma.payment.update).toHaveBeenLastCalledWith({ where: { id: "payment1" }, data: { providerReference: "555" } });
      expect(orders.markPaid).not.toHaveBeenCalled();
    });
  });
});
