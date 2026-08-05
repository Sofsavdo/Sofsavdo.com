import { Body, Controller, Headers, HttpCode, Logger, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { TelegramLinkService } from "./telegram-link.service";
import { Public } from "../common/decorators/public.decorator";

// Telegram's own servers call this directly (no bearer token) — same "public callback controller,
// its own file, always replies 200" shape as ClickCallbackController. Verified via the
// X-Telegram-Bot-Api-Secret-Token header Telegram echoes back once TELEGRAM_WEBHOOK_SECRET is
// registered via the Bot API's setWebhook call; an unset secret is a low, not zero, risk here
// (the only thing an unverified caller could do is forge a fake /start<token>, which still
// requires guessing a real, unexpired, unconsumed 32-char random TelegramLinkToken to have any
// effect) but should still be set in production. Always returns 200 regardless of outcome —
// a non-200 makes Telegram retry-deliver the same update indefinitely.
@SkipThrottle()
@ApiExcludeController()
@Controller("telegram")
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private telegramLink: TelegramLinkService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() body: Record<string, unknown>, @Headers("x-telegram-bot-api-secret-token") secretHeader?: string): Promise<{ ok: true }> {
    const expectedSecret = this.config.get<string>("notifications.telegram.webhookSecret");
    if (expectedSecret && secretHeader !== expectedSecret) {
      this.logger.warn("Rejected Telegram webhook call with missing/invalid secret token");
      return { ok: true };
    }
    try {
      await this.telegramLink.handleWebhookUpdate(body);
    } catch (err) {
      this.logger.error(`Telegram webhook handling failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { ok: true };
  }
}
