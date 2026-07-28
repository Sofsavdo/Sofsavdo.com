import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SendTelegramMessageRequest, TelegramPort, TelegramSendResult } from "./telegram.port";

// Real Telegram Bot API over raw `fetch` — no SDK dependency, same "implement the provider's
// actual published contract directly" precedent as ClickPaymentAdapter (Phase 8). Never fakes
// success: an unconfigured or rejected send returns { ok: false, errorMessage }, which
// NotificationsService records as a FAILED delivery for the admin failed-queue to retry.
@Injectable()
export class TelegramBotAdapter implements TelegramPort {
  constructor(private config: ConfigService) {}

  async send(request: SendTelegramMessageRequest): Promise<TelegramSendResult> {
    const botToken = this.config.get<string>("notifications.telegram.botToken");
    if (!botToken) {
      return { ok: false, errorMessage: "TELEGRAM_BOT_TOKEN is not configured" };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: request.chatId, text: request.html, parse_mode: "HTML" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (!res.ok || !json.ok) {
        return { ok: false, errorMessage: json.description ?? `Telegram API returned HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, errorMessage: err instanceof Error ? err.message : "Unknown Telegram delivery error" };
    }
  }
}
