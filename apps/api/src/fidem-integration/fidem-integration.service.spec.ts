import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FidemIntegrationService } from "./fidem-integration.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { signFidemClickToken, signFidemWebhookPayload } from "./fidem-click-token.util";
import type { FidemWebhookDto } from "./dto/fidem-webhook.dto";

const SECRET = "test-secret";

function buildDto(overrides: Partial<FidemWebhookDto> = {}, flowId = "flow1"): FidemWebhookDto {
  const clickToken = overrides.clickToken ?? signFidemClickToken(flowId, SECRET);
  const externalPaymentId = overrides.externalPaymentId ?? "txn_1";
  const amountMinor = overrides.amountMinor ?? 100_000_00;
  const occurredAt = overrides.occurredAt ?? "2026-01-01T00:00:00.000Z";
  const signature = overrides.signature ?? signFidemWebhookPayload(clickToken, externalPaymentId, amountMinor, occurredAt, SECRET);
  return { clickToken, externalPaymentId, amountMinor, occurredAt, signature, ...overrides };
}

describe("FidemIntegrationService", () => {
  let service: FidemIntegrationService;
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
          product: { id: "prod1", name: "Fidem", commissionType: "PERCENTAGE", commissionRateBps: 3000, commissionAmountMinor: null, externalRedirectUrl: "https://t.me/Fidem_Appbot" },
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [FidemIntegrationService, { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: { get: () => secret } }],
    }).compile();
    service = moduleRef.get(FidemIntegrationService);
  });

  describe("signClickToken", () => {
    it("throws FIDEM_NOT_CONFIGURED when the secret is unset", () => {
      secret = "";
      expect(() => service.signClickToken("flow1")).toThrow(DomainException);
    });

    it("returns a token verifiable with the same secret", () => {
      const token = service.signClickToken("flow1");
      expect(token).toMatch(/^sf_flow1_\d+_[0-9a-f]{16}$/);
    });
  });

  describe("recordConversion", () => {
    it("throws FIDEM_NOT_CONFIGURED when the secret is unset", async () => {
      secret = "";
      await expect(service.recordConversion(buildDto())).rejects.toThrow(DomainException);
    });

    it("throws INVALID_FIDEM_SIGNATURE when the signature doesn't match", async () => {
      await expect(service.recordConversion(buildDto({ signature: "deadbeef" }))).rejects.toMatchObject({ code: "INVALID_FIDEM_SIGNATURE" });
      expect(prisma.commission.create).not.toHaveBeenCalled();
    });

    it("throws INVALID_CLICK_TOKEN when the click token is expired", async () => {
      const clickToken = signFidemClickToken("flow1", SECRET, -1);
      await expect(service.recordConversion(buildDto({ clickToken }))).rejects.toMatchObject({ code: "INVALID_CLICK_TOKEN" });
    });

    it("returns duplicate without creating a second commission for a repeated externalPaymentId", async () => {
      prisma.commission.findUnique.mockResolvedValue({ id: "existing" });
      const result = await service.recordConversion(buildDto());
      expect(result).toEqual({ status: "duplicate" });
      expect(prisma.commission.create).not.toHaveBeenCalled();
    });

    it("throws FLOW_NOT_FOUND when the flow no longer exists or isn't an external-redirect product", async () => {
      prisma.flow.findUnique.mockResolvedValue(null);
      await expect(service.recordConversion(buildDto())).rejects.toMatchObject({ code: "FLOW_NOT_FOUND" });
    });

    it("creates an EXTERNAL commission priced off the product's PERCENTAGE rate and bumps Flow.commissionEarnedMinor", async () => {
      const result = await service.recordConversion(buildDto({ amountMinor: 100_000_00 }));
      expect(result).toEqual({ status: "created" });
      expect(prisma.commission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          creatorId: "creator1",
          source: "EXTERNAL",
          externalRef: "txn_1",
          baseAmountMinor: 100_000_00,
          amountMinor: 30_000_00, // 30% of 100_000_00
          currency: "UZS",
          status: "PENDING",
        }),
      });
      expect(prisma.flow.update).toHaveBeenCalledWith({ where: { id: "flow1" }, data: { commissionEarnedMinor: { increment: 30_000_00 } } });
    });

    it("prices a FIXED_AMOUNT commission product at the flat amount regardless of the payment amount", async () => {
      prisma.flow.findUnique.mockResolvedValue({
        id: "flow1",
        status: "ACTIVE",
        creatorProfileId: "creator1",
        product: { id: "prod1", name: "Fidem", commissionType: "FIXED_AMOUNT", commissionRateBps: null, commissionAmountMinor: 50_000_00, externalRedirectUrl: "https://t.me/Fidem_Appbot" },
      });
      await service.recordConversion(buildDto({ amountMinor: 200_000_00 }));
      expect(prisma.commission.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: 50_000_00 }) });
    });
  });
});
