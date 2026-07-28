import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type Notification, type NotificationCategory, type NotificationChannel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { TELEGRAM_PORT, type TelegramPort } from "./telegram.port";
import { EMAIL_PORT, type EmailPort } from "./email.port";
import { TEMPLATES, type NotificationTypeKey } from "./templates";
import type { NotificationQueryDto } from "./dto/notification-query.dto";
import type { AdminNotificationQueryDto } from "./dto/admin-notification-query.dto";
import type { UpdateNotificationPreferenceDto } from "./dto/update-preference.dto";

const CATEGORIES: NotificationCategory[] = ["CAMPAIGN_APPLICATION", "ORDER", "COMMISSION", "PAYOUT", "ACCOUNT", "ADMIN_ALERTS"];

// Every email this domain sends is transactional (locked constraint) so the safe default is
// opt-out, not opt-in; Telegram defaults off since it additionally requires a linked chat id
// before it can ever deliver anything regardless of this toggle. In-app is always on by default.
const DEFAULT_PREFERENCE = { inApp: true, telegram: false, email: true };

export interface NotificationResponse {
  id: string;
  channel: NotificationChannel;
  type: string;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  status: string;
  createdAt: Date;
}

export interface AdminNotificationResponse extends NotificationResponse {
  user: { id: string; email: string | null; phone: string | null };
  attempts: number;
  lastAttemptAt: Date | null;
  error: string | null;
}

export interface PreferenceResponse {
  category: NotificationCategory;
  inApp: boolean;
  telegram: boolean;
  email: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
    @Inject(TELEGRAM_PORT) private telegram: TelegramPort,
    @Inject(EMAIL_PORT) private email: EmailPort,
  ) {}

  private toResponse(n: Notification): NotificationResponse {
    return { id: n.id, channel: n.channel, type: n.type, payload: n.payload, readAt: n.readAt, status: n.status, createdAt: n.createdAt };
  }

  private toAdminResponse(n: Notification & { user: { id: string; email: string | null; phone: string | null } }): AdminNotificationResponse {
    return { ...this.toResponse(n), user: n.user, attempts: n.attempts, lastAttemptAt: n.lastAttemptAt, error: n.error };
  }

  // ---- Dispatch (called by NotificationEventsListener's direct emits and NotificationSweepService
  // — both funnel through this one entry point so "how does event X become notifications" is
  // never duplicated between a real emit and a swept one). ----

  private async getEffectivePreference(userId: string, category: NotificationCategory): Promise<{ inApp: boolean; telegram: boolean; email: boolean }> {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId_category: { userId, category } } });
    return pref ? { inApp: pref.inApp, telegram: pref.telegram, email: pref.email } : DEFAULT_PREFERENCE;
  }

  // Creates the Notification row and, for TELEGRAM/EMAIL, immediately attempts delivery. A
  // `dedupKey` collision (P2002 on the unique index) means this exact channel-notification for
  // this exact business event was already created — silently skipped, never a duplicate send.
  private async createAndSend(userId: string, channel: NotificationChannel, type: NotificationTypeKey, vars: object, dedupKey?: string): Promise<void> {
    let notification: Notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          userId,
          channel,
          type,
          payload: vars,
          dedupKey: dedupKey ? `${dedupKey}:${channel}` : undefined,
          status: channel === "IN_APP" ? "SENT" : "PENDING",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
      throw err;
    }
    if (channel !== "IN_APP") await this.attemptDelivery(notification.id);
  }

  // Shared by createAndSend's first attempt and the admin retry action — re-reads the row (and
  // its user) fresh each time so a retry always uses the current telegramChatId/email, not a
  // stale snapshot.
  private async attemptDelivery(id: string): Promise<void> {
    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id }, include: { user: { select: { email: true, telegramChatId: true } } } });
    const template = TEMPLATES[notification.type as NotificationTypeKey];
    const vars = notification.payload;

    let result: { ok: boolean; errorMessage?: string };
    if (notification.channel === "TELEGRAM") {
      result = !notification.user.telegramChatId
        ? { ok: false, errorMessage: "Creator has not linked a Telegram chat" }
        : await this.telegram.send({ chatId: notification.user.telegramChatId, html: template.telegram(vars as never) });
    } else {
      if (!notification.user.email) {
        result = { ok: false, errorMessage: "No email address on file" };
      } else {
        const rendered = template.email(vars as never);
        result = await this.email.send({ to: notification.user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      }
    }

    await this.prisma.notification.update({
      where: { id },
      data: { status: result.ok ? "SENT" : "FAILED", attempts: { increment: 1 }, lastAttemptAt: new Date(), error: result.ok ? null : (result.errorMessage ?? null) },
    });
  }

  async dispatchToUser(userId: string, type: NotificationTypeKey, vars: object, dedupKey?: string): Promise<void> {
    const template = TEMPLATES[type];
    const [pref, user] = await Promise.all([
      this.getEffectivePreference(userId, template.category),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, telegramChatId: true } }),
    ]);
    if (!user) return; // best-effort: recipient may no longer exist
    if (pref.inApp) await this.createAndSend(userId, "IN_APP", type, vars, dedupKey);
    if (pref.telegram && user.telegramChatId) await this.createAndSend(userId, "TELEGRAM", type, vars, dedupKey);
    if (pref.email && user.email) await this.createAndSend(userId, "EMAIL", type, vars, dedupKey);
  }

  async dispatchToCreator(creatorId: string, type: NotificationTypeKey, vars: object, dedupKey?: string): Promise<void> {
    const creator = await this.prisma.creatorProfile.findUnique({ where: { id: creatorId }, select: { userId: true } });
    if (!creator) return;
    await this.dispatchToUser(creator.userId, type, vars, dedupKey);
  }

  // Every User whose Role carries `notification.read` — the same permission that gates the admin
  // queue itself, so "who gets admin alerts" never drifts out of sync with "who can see them".
  async dispatchToAdmins(type: NotificationTypeKey, vars: object, dedupKey?: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { permissions: { some: { permission: { key: "notification.read" } } } } } } },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.dispatchToUser(admin.id, type, vars, dedupKey ? `${dedupKey}:${admin.id}` : undefined);
    }
  }

  // Password reset bypasses preference-gating entirely — it is security-critical and explicitly
  // user-initiated (the user just clicked "forgot password"), not a togglable category. See
  // DECISIONS.md ADR-017 and the template's own comment.
  async dispatchPasswordReset(userId: string, resetUrl: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    await this.createAndSend(userId, "EMAIL", "password_reset.requested", { resetUrl });
  }

  // ---- Creator/admin self-service (any authenticated User, not creator-scoped) ----

  async list(userId: string, query: NotificationQueryDto): Promise<PaginatedResult<NotificationResponse>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: query.channel,
      type: query.type,
      readAt: query.unreadOnly === undefined ? undefined : query.unreadOnly ? null : { not: null },
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: query.skip, take: query.take }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items.map((n) => this.toResponse(n)), total, query);
  }

  async findOneOrThrow(id: string, userId: string): Promise<NotificationResponse> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new DomainException("NOTIFICATION_NOT_FOUND", "Bildirishnoma topilmadi.");
    return this.toResponse(n);
  }

  async markRead(id: string, userId: string): Promise<NotificationResponse> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new DomainException("NOTIFICATION_NOT_FOUND", "Bildirishnoma topilmadi.");
    if (!n.readAt) await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return this.findOneOrThrow(id, userId);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { count: result.count };
  }

  async getPreferences(userId: string): Promise<PreferenceResponse[]> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byCategory = new Map(rows.map((r) => [r.category, r]));
    return CATEGORIES.map((category) => {
      const row = byCategory.get(category);
      return row ? { category, inApp: row.inApp, telegram: row.telegram, email: row.email } : { category, ...DEFAULT_PREFERENCE };
    });
  }

  async updatePreference(userId: string, category: NotificationCategory, dto: UpdateNotificationPreferenceDto): Promise<PreferenceResponse> {
    const current = await this.getEffectivePreference(userId, category);
    const merged = { inApp: dto.inApp ?? current.inApp, telegram: dto.telegram ?? current.telegram, email: dto.email ?? current.email };
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, ...merged },
      update: merged,
    });
    return { category: row.category, inApp: row.inApp, telegram: row.telegram, email: row.email };
  }

  // ---- Admin ----

  async adminList(query: AdminNotificationQueryDto): Promise<PaginatedResult<AdminNotificationResponse>> {
    const where: Prisma.NotificationWhereInput = { channel: query.channel, status: query.status, type: query.type, userId: query.userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: query.skip,
        take: query.take,
        include: { user: { select: { id: true, email: true, phone: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items.map((n) => this.toAdminResponse(n)), total, query);
  }

  async adminFindOneOrThrow(id: string): Promise<AdminNotificationResponse> {
    const n = await this.prisma.notification.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, phone: true } } } });
    if (!n) throw new DomainException("NOTIFICATION_NOT_FOUND", "Bildirishnoma topilmadi.");
    return this.toAdminResponse(n);
  }

  async retry(id: string, actorId: string): Promise<AdminNotificationResponse> {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new DomainException("NOTIFICATION_NOT_FOUND", "Bildirishnoma topilmadi.");
    if (n.channel === "IN_APP") throw new DomainException("NOTIFICATION_NOT_RETRYABLE", "In-app bildirishnomalar qayta yuborilmaydi.", { channel: n.channel });
    if (n.status !== "FAILED") throw new DomainException("NOTIFICATION_NOT_RETRYABLE", "Faqat muvaffaqiyatsiz yetkazishlarni qayta urinish mumkin.", { status: n.status });
    const maxAttempts = this.config.get<number>("notifications.maxDeliveryAttempts")!;
    if (n.attempts >= maxAttempts) {
      throw new DomainException("NOTIFICATION_NOT_RETRYABLE", "Qayta urinishlar chegarasiga yetildi.", { attempts: n.attempts, maxAttempts });
    }
    await this.attemptDelivery(id);
    await this.audit.record({ actorId, action: "NOTIFICATION_RETRIED", entityType: "Notification", entityId: id });
    return this.adminFindOneOrThrow(id);
  }
}
