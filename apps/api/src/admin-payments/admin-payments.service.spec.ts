import { Test } from "@nestjs/testing";
import { AdminPaymentsService } from "./admin-payments.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AdminPaymentsService (Phase 12, read-only)", () => {
  let service: AdminPaymentsService;
  let prisma: { payment: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock } };

  const paymentRow = (over: Record<string, unknown> = {}) => ({
    id: "pay1",
    provider: "CLICK",
    status: "PAID",
    amountMinor: 100_000,
    currency: "UZS",
    providerReference: "click-ref-1",
    webhookPayloads: [{ status: "success" }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:05:00Z"),
    order: { id: "order1", publicToken: "tok123", offer: { name: "Glow Serum" }, customer: { fullName: "Malika", phone: "+998900000000" } },
    ...over,
  });

  beforeEach(async () => {
    prisma = { payment: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [AdminPaymentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AdminPaymentsService);
  });

  describe("list", () => {
    it("maps rows to the flattened admin response shape", async () => {
      prisma.payment.findMany.mockResolvedValue([paymentRow()]);
      prisma.payment.count.mockResolvedValue(1);
      const result = await service.list({ page: 1, pageSize: 20, skip: 0, take: 20 });
      expect(result.items[0]).toMatchObject({ id: "pay1", order: { publicToken: "tok123", offerName: "Glow Serum", customerName: "Malika" } });
    });
  });

  describe("findOneOrThrow", () => {
    it("throws PAYMENT_NOT_FOUND for a missing id", async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.findOneOrThrow("missing")).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    });
  });

  describe("getTimeline", () => {
    it("always starts with PENDING at createdAt", async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentRow({ status: "PENDING", webhookPayloads: [] }));
      const timeline = await service.getTimeline("pay1");
      expect(timeline).toEqual([{ label: "PENDING", at: new Date("2026-01-01T00:00:00Z") }]);
    });

    it("appends the current status at updatedAt when it has moved past PENDING", async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentRow({ webhookPayloads: [] }));
      const timeline = await service.getTimeline("pay1");
      expect(timeline).toEqual([
        { label: "PENDING", at: new Date("2026-01-01T00:00:00Z") },
        { label: "PAID", at: new Date("2026-01-01T00:05:00Z") },
      ]);
    });

    it("includes each raw webhook payload received", async () => {
      prisma.payment.findUnique.mockResolvedValue(paymentRow());
      const timeline = await service.getTimeline("pay1");
      expect(timeline.some((e) => e.label === "Provider callback #1" && (e.detail as { status: string }).status === "success")).toBe(true);
    });
  });
});
