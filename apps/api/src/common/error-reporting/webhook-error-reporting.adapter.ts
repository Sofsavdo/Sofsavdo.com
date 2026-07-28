import type { ErrorReportContext, ErrorReportingPort } from "./error-reporting.port";

// A minimal, dependency-free external error-reporting integration: POSTs a JSON payload to any
// webhook-shaped ingest URL (a real APM/error-tracking provider, an internal alerting service,
// etc.) — same "implement the provider's actual published contract directly, no SDK dependency"
// precedent as TelegramBotAdapter. Activated only when ERROR_REPORTING_WEBHOOK_URL is set (see
// ENVIRONMENT.md); unset means this adapter is never constructed at all (see main.ts).
export class WebhookErrorReportingAdapter implements ErrorReportingPort {
  constructor(private readonly webhookUrl: string) {}

  report(error: Error, context: ErrorReportContext): void {
    const payload = {
      message: error.message,
      // Truncated: this is a delivery payload to a third party, not the full server log — the
      // full stack is already captured by AllExceptionsFilter's own logger.error() call.
      stack: error.stack?.slice(0, 4000),
      ...context,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
    // Deliberately not awaited by the caller (see ErrorReportingPort's contract) — a slow or
    // unreachable webhook must never delay the actual error response already being sent.
    fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    }).catch((err) => {
      console.error("[ErrorReporting] failed to deliver error report:", err instanceof Error ? err.message : err);
    });
  }
}
