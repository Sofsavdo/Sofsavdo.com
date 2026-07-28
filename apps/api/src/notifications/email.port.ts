// Provider-independent email delivery boundary (Phase 10) — same convention as TelegramPort/
// PaymentPort/StoragePort.
export const EMAIL_PORT = Symbol("EMAIL_PORT");

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  ok: boolean;
  errorMessage?: string;
}

export interface EmailPort {
  send(request: SendEmailRequest): Promise<EmailSendResult>;
}
