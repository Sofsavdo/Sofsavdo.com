import { Test } from "@nestjs/testing";
import { BuyerAddressesService } from "./buyer-addresses.service";
import { PrismaService } from "../prisma/prisma.service";

describe("BuyerAddressesService", () => {
  let service: BuyerAddressesService;
  let prisma: {
    buyerAddress: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const baseAddress = { id: "addr1", userId: "user1", label: "Uy", region: "Toshkent", city: "Toshkent", district: null, line1: "Chilonzor 1", comment: null, isDefault: false };

  beforeEach(async () => {
    prisma = {
      buyerAddress: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [BuyerAddressesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BuyerAddressesService);
  });

  describe("create", () => {
    it("makes the first address for a user the default automatically", async () => {
      prisma.buyerAddress.count.mockResolvedValue(0);
      await service.create("user1", { region: "Toshkent", city: "Toshkent", line1: "Chilonzor 1" });
      expect(prisma.buyerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }),
      );
    });

    it("does not default a second address", async () => {
      prisma.buyerAddress.count.mockResolvedValue(1);
      await service.create("user1", { region: "Toshkent", city: "Toshkent", line1: "Chilonzor 2" });
      expect(prisma.buyerAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }),
      );
    });
  });

  describe("ownership scoping", () => {
    it("throws NOT_FOUND when updating an address belonging to a different user", async () => {
      prisma.buyerAddress.findUnique.mockResolvedValue({ ...baseAddress, userId: "someone-else" });
      await expect(service.update("addr1", "user1", { line1: "New" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(prisma.buyerAddress.update).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when the address doesn't exist at all", async () => {
      prisma.buyerAddress.findUnique.mockResolvedValue(null);
      await expect(service.remove("missing", "user1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("setDefault", () => {
    it("clears every other default before setting the new one, inside one transaction", async () => {
      prisma.buyerAddress.findUnique.mockResolvedValue(baseAddress);
      prisma.buyerAddress.findUniqueOrThrow.mockResolvedValue({ ...baseAddress, isDefault: true });
      await service.setDefault("addr1", "user1");
      expect(prisma.buyerAddress.updateMany).toHaveBeenCalledWith({ where: { userId: "user1", isDefault: true }, data: { isDefault: false } });
      expect(prisma.buyerAddress.update).toHaveBeenCalledWith({ where: { id: "addr1" }, data: { isDefault: true } });
    });
  });

  describe("remove", () => {
    it("promotes the next-oldest address to default when the deleted one was the default", async () => {
      prisma.buyerAddress.findUnique.mockResolvedValue({ ...baseAddress, isDefault: true });
      prisma.buyerAddress.findFirst.mockResolvedValue({ id: "addr2" });
      await service.remove("addr1", "user1");
      expect(prisma.buyerAddress.update).toHaveBeenCalledWith({ where: { id: "addr2" }, data: { isDefault: true } });
    });

    it("does not touch any other address when the deleted one wasn't the default", async () => {
      prisma.buyerAddress.findUnique.mockResolvedValue({ ...baseAddress, isDefault: false });
      await service.remove("addr1", "user1");
      expect(prisma.buyerAddress.update).not.toHaveBeenCalled();
    });
  });
});
