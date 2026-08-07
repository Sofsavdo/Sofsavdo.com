import { Test } from "@nestjs/testing";
import { ChatService, type ChatIdentity } from "./chat.service";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "../roles/roles.service";

describe("ChatService", () => {
  let service: ChatService;
  let prisma: {
    chatConversation: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    chatMessage: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    chatParticipant: { upsert: jest.Mock; updateMany: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let roles: { getRoleKeysAndPermissionsForUser: jest.Mock };

  const creator: ChatIdentity = { userId: "u-creator", creatorId: "c1", isAdmin: false };
  const admin: ChatIdentity = { userId: "u-admin", creatorId: null, isAdmin: true };

  beforeEach(async () => {
    prisma = {
      chatConversation: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
      chatMessage: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      chatParticipant: { upsert: jest.fn(), updateMany: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    roles = { getRoleKeysAndPermissionsForUser: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: RolesService, useValue: roles },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  describe("resolveIdentity", () => {
    it("rejects a buyer (neither creator nor staff) with null", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", status: "ACTIVE", creatorProfile: null });
      roles.getRoleKeysAndPermissionsForUser.mockResolvedValue({ roleKeys: [], permissions: [] });
      expect(await service.resolveIdentity("u1")).toBeNull();
    });

    it("resolves a creator with isAdmin false", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", status: "ACTIVE", creatorProfile: { id: "c1" } });
      roles.getRoleKeysAndPermissionsForUser.mockResolvedValue({ roleKeys: [], permissions: [] });
      expect(await service.resolveIdentity("u1")).toEqual({ userId: "u1", creatorId: "c1", isAdmin: false });
    });

    it("resolves a staff user with isAdmin true", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", status: "ACTIVE", creatorProfile: null });
      roles.getRoleKeysAndPermissionsForUser.mockResolvedValue({ roleKeys: ["MANAGER"], permissions: [] });
      expect(await service.resolveIdentity("u2")).toEqual({ userId: "u2", creatorId: null, isAdmin: true });
    });

    it("rejects an inactive user", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u3", status: "SUSPENDED", creatorProfile: { id: "c9" } });
      expect(await service.resolveIdentity("u3")).toBeNull();
    });
  });

  describe("sendMessage authorization + validation", () => {
    it("forbids a creator from posting in another creator's DIRECT thread", async () => {
      prisma.chatConversation.findUnique.mockResolvedValue({ id: "conv1", type: "DIRECT", creatorUserId: "someone-else" });
      await expect(service.sendMessage("conv1", creator, "salom")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects an empty message", async () => {
      await expect(service.sendMessage("conv1", creator, "   ")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("lets the owning creator post and bumps lastMessageAt in one transaction", async () => {
      prisma.chatConversation.findUnique.mockResolvedValue({ id: "conv1", type: "DIRECT", creatorUserId: "u-creator" });
      prisma.$transaction.mockResolvedValue([
        { id: "m1", conversationId: "conv1", senderId: "u-creator", senderIsAdmin: false, body: "salom", createdAt: new Date(), sender: { displayName: null, email: null, creatorProfile: { displayName: "Lola" } } },
        {},
      ]);
      const result = await service.sendMessage("conv1", creator, "  salom  ");
      expect(result.body).toBe("salom");
      expect(result.mine).toBe(true);
      expect(result.senderName).toBe("Lola");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("lets any admin post in a creator's DIRECT thread", async () => {
      prisma.chatConversation.findUnique.mockResolvedValue({ id: "conv1", type: "DIRECT", creatorUserId: "u-creator" });
      prisma.$transaction.mockResolvedValue([
        { id: "m2", conversationId: "conv1", senderId: "u-admin", senderIsAdmin: true, body: "javob", createdAt: new Date(), sender: { displayName: "Admin", email: null, creatorProfile: null } },
        {},
      ]);
      const result = await service.sendMessage("conv1", admin, "javob");
      expect(result.senderIsAdmin).toBe(true);
    });
  });

  describe("markRead", () => {
    it("writes the shared admin cursor for a DIRECT thread when an admin reads", async () => {
      prisma.chatConversation.findUnique.mockResolvedValue({ id: "conv1", type: "DIRECT", creatorUserId: "u-creator" });
      await service.markRead("conv1", admin);
      expect(prisma.chatConversation.update).toHaveBeenCalledWith({ where: { id: "conv1" }, data: { adminLastReadAt: expect.any(Date) } });
      expect(prisma.chatParticipant.updateMany).not.toHaveBeenCalled();
    });

    it("writes the creator's own participant cursor for their DIRECT thread", async () => {
      prisma.chatConversation.findUnique.mockResolvedValue({ id: "conv1", type: "DIRECT", creatorUserId: "u-creator" });
      await service.markRead("conv1", creator);
      expect(prisma.chatParticipant.updateMany).toHaveBeenCalledWith({ where: { conversationId: "conv1", userId: "u-creator" }, data: { lastReadAt: expect.any(Date) } });
      expect(prisma.chatConversation.update).not.toHaveBeenCalled();
    });
  });
});
