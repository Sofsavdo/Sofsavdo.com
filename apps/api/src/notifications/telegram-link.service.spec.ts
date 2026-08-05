import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { NotificationCategory } from "@prisma/client";
import { TelegramLinkService } from "./telegram-link.service";
import { PrismaService } from "../prisma/prisma.service";
import { TELEGRAM_PORT } from "./telegram.port";
import { DomainException } from "../common/errors/domain-error";

describe("TelegramLinkService", () => {
  let service: TelegramLinkService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    telegramLinkToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    notificationPreference: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let telegram: { send: jest.Mock };
  let botUsername: string;

  beforeEach(async () => {
    botUsername = "InfulienceXbot";
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      telegramLinkToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      notificationPreference: { upsert: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    telegram = { send: jest.fn().mockResolvedValue({ ok: true }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => botUsername } },
        { provide: TELEGRAM_PORT, useValue: telegram },
      ],
    }).compile();
    service = moduleRef.get(TelegramLinkService);
  });

  describe("createLinkToken", () => {
    it("throws TELEGRAM_NOT_CONFIGURED when the bot username is unset", async () => {
      botUsername = "";
      await expect(service.createLinkToken("user1")).rejects.toThrow(DomainException);
      expect(prisma.telegramLinkToken.create).not.toHaveBeenCalled();
    });

    it("creates a stored token and returns a valid t.me deep link", async () => {
      const result = await service.createLinkToken("user1");
      expect(result.deepLink).toMatch(/^https:\/\/t\.me\/InfulienceXbot\?start=[A-Za-z0-9_-]+$/);
      expect(result.botUsername).toBe("InfulienceXbot");
      expect(prisma.telegramLinkToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user1" }) }),
      );
    });
  });

  describe("getStatus", () => {
    it("reports linked:true only when telegramChatId is set", async () => {
      prisma.user.findUnique.mockResolvedValue({ telegramChatId: "555" });
      await expect(service.getStatus("user1")).resolves.toEqual({ linked: true });

      prisma.user.findUnique.mockResolvedValue({ telegramChatId: null });
      await expect(service.getStatus("user1")).resolves.toEqual({ linked: false });
    });
  });

  describe("unlink", () => {
    it("clears telegramChatId and reports linked:false", async () => {
      const result = await service.unlink("user1");
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { telegramChatId: null } });
      expect(result).toEqual({ linked: false });
    });
  });

  describe("handleWebhookUpdate", () => {
    const validToken = { id: "tok1", token: "abc123", userId: "user1", expiresAt: new Date(Date.now() + 60_000), consumedAt: null };

    it("ignores updates with no message text (non-message updates)", async () => {
      await service.handleWebhookUpdate({ update_id: 1 });
      expect(prisma.telegramLinkToken.findUnique).not.toHaveBeenCalled();
      expect(telegram.send).not.toHaveBeenCalled();
    });

    it("replies with a pointer message on a bare /start with no payload", async () => {
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start" } });
      expect(prisma.telegramLinkToken.findUnique).not.toHaveBeenCalled();
      expect(telegram.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "555" }));
    });

    it("replies with a help pointer on any non-/start text", async () => {
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "salom" } });
      expect(telegram.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "555" }));
    });

    it("rejects an unknown, expired, or already-consumed token without linking anything", async () => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue(null);
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start bogus" } });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(telegram.send).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining("eskirgan") }));

      jest.clearAllMocks();
      prisma.telegramLinkToken.findUnique.mockResolvedValue({ ...validToken, consumedAt: new Date() });
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start abc123" } });
      expect(prisma.user.update).not.toHaveBeenCalled();

      jest.clearAllMocks();
      prisma.telegramLinkToken.findUnique.mockResolvedValue({ ...validToken, expiresAt: new Date(Date.now() - 1) });
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start abc123" } });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("links the chat id to the token's user, consumes the token, enables telegram prefs, and confirms in-chat", async () => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue(validToken);
      await service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start abc123" } });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { telegramChatId: "555" }, data: { telegramChatId: null } });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { telegramChatId: "555" } });
      expect(prisma.telegramLinkToken.update).toHaveBeenCalledWith({ where: { id: "tok1" }, data: { consumedAt: expect.any(Date) } });
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(Object.values(NotificationCategory).length);
      expect(telegram.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "555", html: expect.stringContaining("ulandi") }));
    });

    it("never throws even if the confirmation send fails (best-effort reply)", async () => {
      telegram.send.mockResolvedValue({ ok: false, errorMessage: "blocked by user" });
      prisma.telegramLinkToken.findUnique.mockResolvedValue(validToken);
      await expect(service.handleWebhookUpdate({ message: { chat: { id: 555 }, text: "/start abc123" } })).resolves.toBeUndefined();
    });
  });
});
