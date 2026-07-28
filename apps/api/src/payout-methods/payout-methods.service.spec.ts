import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PayoutMethodsService } from "./payout-methods.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { encryptSecret } from "../common/crypto/encryption.util";

describe("PayoutMethodsService", () => {
  let service: PayoutMethodsService;
  let prisma: {
    payoutMethod: { findMany: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: { record: jest.Mock };
  const SECRET = "test-secret";

  const cardMethod = {
    id: "pm1",
    creatorId: "creator1",
    type: "CARD" as const,
    cardNumberEnc: encryptSecret("8600123412341234", SECRET),
    cardHolder: "Malika Yusupova",
    bankName: null,
    bankAccount: null,
    isDefault: true,
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      payoutMethod: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((arr: unknown[]) => Promise.all(arr)),
    };
    audit = { record: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutMethodsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => SECRET } },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(PayoutMethodsService);
  });

  describe("listMine", () => {
    it("masks the card number, never returning the encrypted or raw value", async () => {
      prisma.payoutMethod.findMany.mockResolvedValue([cardMethod]);
      const result = await service.listMine("creator1");
      expect(result[0]!.label).toBe("•••• 1234 — Malika Yusupova");
      expect(JSON.stringify(result)).not.toContain("cardNumberEnc");
      expect(JSON.stringify(result)).not.toContain("8600123412341234");
    });

    it("masks a bank account the same way", async () => {
      prisma.payoutMethod.findMany.mockResolvedValue([{ ...cardMethod, type: "BANK_ACCOUNT", cardNumberEnc: null, cardHolder: null, bankName: "Xalq Banki", bankAccount: "20208000900123456789" }]);
      const result = await service.listMine("creator1");
      expect(result[0]!.label).toBe("Xalq Banki — •••• 6789");
    });
  });

  describe("create", () => {
    it("encrypts the card number before storing it", async () => {
      prisma.payoutMethod.count.mockResolvedValue(0);
      prisma.payoutMethod.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "pm2", ...data, createdAt: new Date() }));
      const result = await service.create("creator1", "user1", { type: "CARD", cardNumber: "8600 1234 5678 9012", cardHolder: "Aziz Karimov" });
      const createCall = prisma.payoutMethod.create.mock.calls[0][0];
      expect(createCall.data.cardNumberEnc).not.toBe("8600 1234 5678 9012");
      expect(createCall.data.cardNumberEnc).toContain(":"); // iv:authTag:ciphertext
      expect(result.label).toBe("•••• 9012 — Aziz Karimov");
    });

    it("makes the first payout method the default automatically", async () => {
      prisma.payoutMethod.count.mockResolvedValue(0);
      prisma.payoutMethod.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "pm2", ...data, createdAt: new Date() }));
      await service.create("creator1", "user1", { type: "CARD", cardNumber: "8600123456789012", cardHolder: "Aziz" });
      expect(prisma.payoutMethod.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }));
    });

    it("does not default a second payout method", async () => {
      prisma.payoutMethod.count.mockResolvedValue(1);
      prisma.payoutMethod.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "pm2", ...data, createdAt: new Date() }));
      await service.create("creator1", "user1", { type: "CARD", cardNumber: "8600123456789012", cardHolder: "Aziz" });
      expect(prisma.payoutMethod.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }));
    });
  });

  describe("setDefault / deactivate", () => {
    it("rejects operating on a payout method owned by a different creator (no id-guessing oracle)", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue({ ...cardMethod, creatorId: "other-creator" });
      await expect(service.setDefault("pm1", "creator1", "user1")).rejects.toMatchObject({ code: "PAYOUT_METHOD_NOT_FOUND" });
    });

    it("deactivates (soft-delete) rather than removing the row", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(cardMethod);
      prisma.payoutMethod.findFirst.mockResolvedValue(null);
      await service.deactivate("pm1", "creator1", "user1");
      expect(prisma.payoutMethod.update).toHaveBeenCalledWith({ where: { id: "pm1" }, data: { isActive: false, isDefault: false } });
    });

    it("promotes the next active method to default when the removed one was the default", async () => {
      prisma.payoutMethod.findUnique.mockResolvedValue(cardMethod);
      prisma.payoutMethod.findFirst.mockResolvedValue({ id: "pm2" });
      await service.deactivate("pm1", "creator1", "user1");
      expect(prisma.payoutMethod.update).toHaveBeenCalledWith({ where: { id: "pm2" }, data: { isDefault: true } });
    });
  });
});
