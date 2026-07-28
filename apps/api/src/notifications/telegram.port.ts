// Provider-independent Telegram delivery boundary (Phase 10) — same convention as PaymentPort/
// StoragePort. NotificationsService depends only on this port, never on the concrete Bot API
// client, so a future swap (e.g. a queue-backed sender) means one adapter class and a module
// binding change, no domain-layer changes.
export const TELEGRAM_PORT = Symbol("TELEGRAM_PORT");

export interface SendTelegramMessageRequest {
  chatId: string;
  /** Telegram's own restricted HTML subset (<b>/<i>/<a>/<code> etc.) — see templates registry. */
  html: string;
}

export interface TelegramSendResult {
  ok: boolean;
  errorMessage?: string;
}

export interface TelegramPort {
  send(request: SendTelegramMessageRequest): Promise<TelegramSendResult>;
}
