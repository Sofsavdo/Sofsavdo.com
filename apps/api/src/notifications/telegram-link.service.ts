import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { NotificationCategory } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { TELEGRAM_PORT, type TelegramPort } from "./telegram.port";

const LINK_TOKEN_TTL_MINUTES = 15;
const ALL_CATEGORIES = Object.values(NotificationCategory);

export interface TelegramLinkTokenResponse {
  deepLink: string;
  botUsername: string;
  expiresAt: Date;
}

export interface TelegramLinkStatusResponse {
  linked: boolean;
}

// Turns a Telegram Update (webhook body) and an authenticated-user session into a linked
// User.telegramChatId, using a short-lived opaque token exchanged via the bot's /start deep link
// — see TelegramLinkToken's schema comment for why this can't reuse AuthService's stateless-JWT
// password-reset pattern. Kept as its own service (not folded into NotificationsService) because
// its dependency shape is different: it talks to TelegramPort directly to reply inside the chat,
// rather than going through the Notification/preference pipeline.
@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(TELEGRAM_PORT) private telegram: TelegramPort,
  ) {}

  async createLinkToken(userId: string): Promise<TelegramLinkTokenResponse> {
    const botUsername = this.config.get<string>("notifications.telegram.botUsername");
    if (!botUsername) {
      throw new DomainException("TELEGRAM_NOT_CONFIGURED", "Telegram bot hali sozlanmagan.");
    }
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MINUTES * 60_000);
    await this.prisma.telegramLinkToken.create({ data: { token, userId, expiresAt } });
    return { deepLink: `https://t.me/${botUsername}?start=${token}`, botUsername, expiresAt };
  }

  async getStatus(userId: string): Promise<TelegramLinkStatusResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
    return { linked: !!user?.telegramChatId };
  }

  async unlink(userId: string): Promise<TelegramLinkStatusResponse> {
    await this.prisma.user.update({ where: { id: userId }, data: { telegramChatId: null } });
    return { linked: false };
  }

  // Every reply here is best-effort — a failed confirmation send must never surface as a webhook
  // error (Telegram would just retry-deliver the same update), so failures are logged, not thrown.
  private async reply(chatId: string, html: string): Promise<void> {
    const result = await this.telegram.send({ chatId, html });
    if (!result.ok) this.logger.warn(`Telegram reply to chat ${chatId} failed: ${result.errorMessage}`);
  }

  // Processes one Telegram Update (webhook body). Only "/start <token>" is meaningful; every other
  // message gets a short pointer back to the linking button rather than being silently dropped, so
  // a confused user always gets *some* response from the bot.
  async handleWebhookUpdate(update: Record<string, unknown>): Promise<void> {
    const message = update.message as Record<string, unknown> | undefined;
    const chat = message?.chat as Record<string, unknown> | undefined;
    const text = message?.text;
    if (!message || !chat || typeof chat.id !== "number" || typeof text !== "string") return;
    const chatId = String(chat.id);

    const match = /^\/start(?:\s+(\S+))?/.exec(text.trim());
    if (!match) {
      await this.reply(chatId, "Akkauntingizni ulash uchun admin panel yoki creator kabinetdagi sozlamalardan \"Telegramni ulash\" tugmasini bosing.");
      return;
    }

    const tokenValue = match[1];
    if (!tokenValue) {
      await this.reply(chatId, "Akkauntingizni ulash uchun admin panel yoki creator kabinetdagi sozlamalardan \"Telegramni ulash\" tugmasini bosing.");
      return;
    }

    const linkToken = await this.prisma.telegramLinkToken.findUnique({ where: { token: tokenValue } });
    if (!linkToken || linkToken.consumedAt || linkToken.expiresAt < new Date()) {
      await this.reply(chatId, "Havola eskirgan yoki noto'g'ri. Iltimos, saytdan qaytadan \"Telegramni ulash\" tugmasini bosing.");
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // A Telegram chat id can only ever point at one Sofsavdo account — re-linking the same chat
      // to a different account moves the link rather than erroring, since from the human's
      // perspective this is just "I'm switching which account gets my Telegram notifications."
      await tx.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null } });
      await tx.user.update({ where: { id: linkToken.userId }, data: { telegramChatId: chatId } });
      await tx.telegramLinkToken.update({ where: { id: linkToken.id }, data: { consumedAt: new Date() } });
      // Linking is an unambiguous "send me Telegram notifications now" signal — without this, the
      // chat id would be populated but every category's default telegram:false would keep it silent.
      await Promise.all(
        ALL_CATEGORIES.map((category) =>
          tx.notificationPreference.upsert({
            where: { userId_category: { userId: linkToken.userId, category } },
            create: { userId: linkToken.userId, category, telegram: true },
            update: { telegram: true },
          }),
        ),
      );
    });

    await this.reply(chatId, "✅ <b>Telegram ulandi!</b>\nEndi Sofsavdo bildirishnomalarini shu yerda olasiz.");
  }
}
