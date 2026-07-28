export interface ErrorReportContext {
  requestId: string;
  statusCode: number;
  code: string;
  method: string;
  path: string;
  userId?: string;
}

// Same "swap the adapter, never the call site" shape as PaymentPort/StoragePort/TelegramPort/
// EmailPort — AllExceptionsFilter depends on this interface only, so a real provider (Sentry,
// Bugsnag, an internal alerting service) plugs in without either module ever changing.
export interface ErrorReportingPort {
  // Fire-and-forget by contract: implementations must never throw synchronously and must never
  // make the caller await real network I/O — reporting an error must never slow down or risk
  // failing the error response already being sent to the actual user.
  report(error: Error, context: ErrorReportContext): void;
}
