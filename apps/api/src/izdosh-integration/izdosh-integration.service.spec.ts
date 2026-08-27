import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { IzdoshIntegrationService } from "./izdosh-integration.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { signIzdoshClickToken, signIzdoshWebhookPayload } from "./izdosh-click-token.util";
import type { IzdoshWebhookDto } from "./dto/izdosh-webhook.dto";

const SECRET = "test-secret";

function buildDto(overrides: Partial<IzdoshWebhookDto> = {}, flowId = "flow1"): IzdoshWebhookDto {
  const clickToken = overrides.clickToken ?? signIzdoshClickToken(flowId, SECRET);
  const externalPaymentId = overrides.externalPaymentId ?? "pay_1";
  const amountMinor = overrides.amountMinor ?? 1_490_000_00;
  const commissionAmountMinor = overrides.commissionAmountMinor ?? 74_500_00;
  const occurredAt = overrides.occurredAt ?? "2026-01-01T00:00:00.000Z";
  const signature = overrides.signature ?? signIzdoshWebhookPayload(clickToken, externalPaymentId, amountMinor, commissionAmountMinor, occurredAt, SECRET);
  return { clickToken, externalPaymentId, amountMinor, commissionAmountMinor, occurredAt, signature, ...overrides };
}

describe("IzdoshIntegrationService", () => {
  let service: IzdoshIntegrationService;
  let prisma: {
    commission: { findUnique: jest.Mock; create: jest.Mock };
    flow: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let secret: string;

  beforeEach(async () => {
    secret = SECRET;
    prisma = {
      commission: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      flow: {
        findUnique: jest.fn().mockResolvedValue({
          id: "flow1",
          status: "ACTIVE",
          creatorProfileId: "creator1",
          product: { id: "prod1", name: "Uzum Market", externalRedirectUrl: "https://izdosh.uz/courses/uzum-market" },
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [IzdoshIntegrationService, { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: { get: () => secret } }],
    }).compile();
    service = moduleRef.get(IzdoshIntegrationService);
  });

  describe("signClickToken", () => {
    it("throws IZDOSH_NOT_CONFIGURED when the secret is unset", () => {
      secret = "";
      expect(() => service.signClickToken("flow1")).toThrow(DomainException);
    });

    it("returns a token verifiable with the same secret", () => {
      const token = service.signClickToken("flow1");
      expect(token).toMatch(/^iz_flow1_\d+_[0-9a-f]{16}$/);
    });
  });

  describe("recordConversion", () => {
    it("throws IZDOSH_NOT_CONFIGURED when the secret is unset", async () => {
      secret = "";
      await expect(service.recordConversion(buildDto())).rejects.toThrow(DomainException);
    });

    it("throws INVALID_IZDOSH_SIGNATURE when the signature doesn't match", async () => {
      await expect(service.recordConversion(buildDto({ signature: "deadbeef" }))).rejects.toMatchObject({ code: "INVALID_IZDOSH_SIGNATURE" });
      expect(prisma.commission.create).not.toHaveBeenCalled();
    });

    it("throws INVALID_AMOUNT when the reported commission exceeds the payment amount", async () => {
      await expect(service.recordConversion(buildDto({ amountMinor: 10_000_00, commissionAmountMinor: 20_000_00 }))).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
      expect(prisma.commission.create).not.toHaveBeenCalled();
    });

    it("throws INVALID_CLICK_TOKEN when the click token is expired", async () => {
      const clickToken = signIzdoshClickToken("flow1", SECRET, -1);
      await expect(service.recordConversion(buildDto({ clickToken }))).rejects.toMatchObject({ code: "INVALID_CLICK_TOKEN" });
    });

    it("returns duplicate without creating a second commission for a repeated externalPaymentId", async () => {
      prisma.commission.findUnique.mockResolvedValue({ id: "existing" });
      const result = await service.recordConversion(buildDto());
      expect(result).toEqual({ status: "duplicate" });
      expect(prisma.commission.create).not.toHaveBeenCalled();
    });

    // Regression test: the duplicate check above runs outside the transaction, so two
    // near-simultaneous retries of the same webhook can both pass it before either commits — the
    // losing one used to surface a raw, unhandled P2002 instead of a clean duplicate response.
    it("returns duplicate (not a raw 500) when a concurrent retry loses the unique-constraint race", async () => {
      const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      prisma.commission.create.mockRejectedValue(p2002);
      const result = await service.recordConversion(buildDto());
      expect(result).toEqual({ status: "duplicate" });
    });

    it("re-throws a non-P2002 transaction error instead of swallowing it", async () => {
      prisma.commission.create.mockRejectedValue(new Error("connection lost"));
      await expect(service.recordConversion(buildDto())).rejects.toThrow("connection lost");
    });

    it("throws FLOW_NOT_FOUND when the flow no longer exists or isn't an external-redirect product", async () => {
      prisma.flow.findUnique.mockResolvedValue(null);
      await expect(service.recordConversion(buildDto())).rejects.toMatchObject({ code: "FLOW_NOT_FOUND" });
    });

    it("records the 5% commission Izdosh reports as-is, without re-deriving it from any product commission rate", async () => {
      const result = await service.recordConversion(buildDto({ amountMinor: 1_490_000_00, commissionAmountMinor: 74_500_00 }));
      expect(result).toEqual({ status: "created" });
      expect(prisma.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          creatorId: "creator1",
          source: "EXTERNAL",
          externalRef: "pay_1",
          baseAmountMinor: 1_490_000_00,
          amountMinor: 74_500_00,
          currency: "UZS",
          status: "PENDING",
        }),
      });
      expect(prisma.flow.update).toHaveBeenCalledWith({ where: { id: "flow1" }, data: { commissionEarnedMinor: { increment: 74_500_00 } } });
    });
  });
});
