import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { TELEGRAM_PORT } from "./telegram.port";
import { EMAIL_PORT } from "./email.port";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "7.8.0" });
}

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: {
    notification: { create: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
    notificationPreference: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    creatorProfile: { findUnique: jest.Mock };
  };
  let telegram: { send: jest.Mock };
  let email: { send: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: { create: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
      notificationPreference: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      creatorProfile: { findUnique: jest.fn() },
    };
    telegram = { send: jest.fn() };
    email = { send: jest.fn() };
    audit = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === "notifications.maxDeliveryAttempts" ? 3 : undefined) } },
        { provide: AuditService, useValue: audit },
        { provide: TELEGRAM_PORT, useValue: telegram },
        { provide: EMAIL_PORT, useValue: email },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  describe("dispatchToUser", () => {
    it("creates an IN_APP notification directly as SENT, no delivery attempt", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null); // no override row -> defaults
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: null });
      prisma.notification.create.mockResolvedValue({ id: "n1" });

      await service.dispatchToUser("user1", "user.registered", { displayName: "Aziz" });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: "IN_APP", status: "SENT" }) }));
      expect(telegram.send).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it("also sends EMAIL when the default preference allows it and the user has an email", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ email: "aziz@example.uz", telegramChatId: null });
      prisma.notification.create.mockResolvedValueOnce({ id: "n1" }).mockResolvedValueOnce({ id: "n2" });
      prisma.notification.findUniqueOrThrow.mockResolvedValue({
        id: "n2",
        channel: "EMAIL",
        type: "user.registered",
        payload: { displayName: "Aziz" },
        user: { email: "aziz@example.uz", telegramChatId: null },
      });
      email.send.mockResolvedValue({ ok: true });

      await service.dispatchToUser("user1", "user.registered", { displayName: "Aziz" });

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: "aziz@example.uz" }));
      expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: "n2" }, data: expect.objectContaining({ status: "SENT", error: null }) });
    });

    it("skips TELEGRAM when the user has no linked chat id, even if the category allows it", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ inApp: true, telegram: true, email: false });
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: null });
      prisma.notification.create.mockResolvedValue({ id: "n1" });

      await service.dispatchToUser("user1", "user.registered", { displayName: "Aziz" });

      expect(telegram.send).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledTimes(1); // IN_APP only
    });

    it("marks a channel FAILED when the port reports failure, recording the error", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ inApp: false, telegram: true, email: false });
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: "chat123" });
      prisma.notification.create.mockResolvedValue({ id: "n1" });
      prisma.notification.findUniqueOrThrow.mockResolvedValue({
        id: "n1",
        channel: "TELEGRAM",
        type: "user.registered",
        payload: { displayName: "Aziz" },
        user: { email: null, telegramChatId: "chat123" },
      });
      telegram.send.mockResolvedValue({ ok: false, errorMessage: "bot blocked" });

      await service.dispatchToUser("user1", "user.registered", { displayName: "Aziz" });

      expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: expect.objectContaining({ status: "FAILED", error: "bot blocked" }) });
    });

    it("silently skips a duplicate dispatch (dedupKey unique-constraint collision), never throwing", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: null });
      prisma.notification.create.mockRejectedValue(p2002());

      await expect(service.dispatchToUser("user1", "user.registered", { displayName: "Aziz" }, "user.registered:1")).resolves.toBeUndefined();
    });

    it("is a no-op when the recipient user no longer exists", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.dispatchToUser("gone", "user.registered", { displayName: "Aziz" });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("dispatchToCreator", () => {
    it("resolves creatorId to the underlying userId before dispatching", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue({ userId: "user1" });
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: null });
      prisma.notification.create.mockResolvedValue({ id: "n1" });

      await service.dispatchToCreator("creator1", "commission.approved", { amountMinor: 1000, currency: "UZS" });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user1" }, select: { email: true, telegramChatId: true } });
    });

    it("is a no-op when the creator profile doesn't exist", async () => {
      prisma.creatorProfile.findUnique.mockResolvedValue(null);
      await service.dispatchToCreator("gone", "commission.approved", { amountMinor: 1000, currency: "UZS" });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("dispatchToAdmins", () => {
    it("dispatches to every user holding notification.read, with a per-admin dedup suffix", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "admin1" }, { id: "admin2" }]);
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ email: null, telegramChatId: null });
      prisma.notification.create.mockResolvedValue({ id: "n1" });

      await service.dispatchToAdmins("payout.failed.admin", { amountMinor: 1, currency: "UZS", creatorName: "X", reason: "y" }, "payout.failed.admin:p1");

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { roles: { some: { role: { permissions: { some: { permission: { key: "notification.read" } } } } } } } }),
      );
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("dispatchPasswordReset", () => {
    it("always sends via email regardless of any preference", async () => {
      prisma.user.findUnique.mockResolvedValue({ email: "aziz@example.uz" });
      prisma.notification.create.mockResolvedValue({ id: "n1" });
      prisma.notification.findUniqueOrThrow.mockResolvedValue({
        id: "n1",
        channel: "EMAIL",
        type: "password_reset.requested",
        payload: { resetUrl: "https://x/reset?token=abc" },
        user: { email: "aziz@example.uz", telegramChatId: null },
      });
      email.send.mockResolvedValue({ ok: true });

      await service.dispatchPasswordReset("user1", "https://x/reset?token=abc");

      expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
      expect(email.send).toHaveBeenCalled();
    });

    it("is a no-op when the user has no email on file", async () => {
      prisma.user.findUnique.mockResolvedValue({ email: null });
      await service.dispatchPasswordReset("user1", "https://x/reset?token=abc");
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("list / findOneOrThrow / markRead / markAllRead", () => {
    it("rejects reading another user's notification (no id-guessing oracle)", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "other-user" });
      await expect(service.findOneOrThrow("n1", "user1")).rejects.toMatchObject({ code: "NOTIFICATION_NOT_FOUND" });
    });

    it("marks a notification read exactly once (idempotent, no update if already read)", async () => {
      const readAt = new Date();
      prisma.notification.findUnique.mockResolvedValueOnce({ id: "n1", userId: "user1", readAt }).mockResolvedValueOnce({ id: "n1", userId: "user1", readAt });
      await service.markRead("n1", "user1");
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("marks all unread notifications for the user read", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllRead("user1");
      expect(result).toEqual({ count: 3 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: "user1", readAt: null }, data: { readAt: expect.any(Date) } });
    });
  });

  describe("preferences", () => {
    it("returns all 6 categories with defaults when no preference rows exist", async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      const result = await service.getPreferences("user1");
      expect(result).toHaveLength(6);
      expect(result.find((r) => r.category === "PAYOUT")).toEqual({ category: "PAYOUT", inApp: true, telegram: false, email: true });
    });

    it("merges a partial preference update against the current effective value", async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null); // current = defaults
      prisma.notificationPreference.upsert.mockImplementation(({ create }) => Promise.resolve(create));

      const result = await service.updatePreference("user1", "PAYOUT", { telegram: true });

      expect(result).toEqual({ category: "PAYOUT", inApp: true, telegram: true, email: true });
    });
  });

  describe("admin: retry", () => {
    it("rejects retrying an IN_APP notification", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", channel: "IN_APP", status: "SENT", attempts: 0 });
      await expect(service.retry("n1", "admin1")).rejects.toMatchObject({ code: "NOTIFICATION_NOT_RETRYABLE" });
    });

    it("rejects retrying a notification that isn't FAILED", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", channel: "EMAIL", status: "SENT", attempts: 1 });
      await expect(service.retry("n1", "admin1")).rejects.toMatchObject({ code: "NOTIFICATION_NOT_RETRYABLE" });
    });

    it("rejects retrying once the attempt limit is reached", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", channel: "EMAIL", status: "FAILED", attempts: 3 });
      await expect(service.retry("n1", "admin1")).rejects.toMatchObject({ code: "NOTIFICATION_NOT_RETRYABLE" });
    });

    it("retries a FAILED notification, re-attempts delivery, and records an audit entry", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", channel: "EMAIL", status: "FAILED", attempts: 1 });
      prisma.notification.findUniqueOrThrow.mockResolvedValue({
        id: "n1",
        channel: "EMAIL",
        type: "payout.paid",
        payload: { amountMinor: 100, currency: "UZS" },
        user: { email: "aziz@example.uz", telegramChatId: null },
      });
      email.send.mockResolvedValue({ ok: true });
      prisma.notification.findUnique.mockResolvedValueOnce({ id: "n1", channel: "EMAIL", status: "FAILED", attempts: 1 });

      await service.retry("n1", "admin1");

      expect(email.send).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin1", action: "NOTIFICATION_RETRIED", entityType: "Notification", entityId: "n1" }));
    });
  });
});
