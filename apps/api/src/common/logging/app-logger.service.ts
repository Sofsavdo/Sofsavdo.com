import { ConsoleLogger, Injectable, Scope } from "@nestjs/common";

// Structured (JSON) logging in production, human-readable in development — same interface
// NestJS's built-in Logger uses, so `app.useLogger()` + `new Logger(ctx)` call sites elsewhere
// don't need to change if this gets swapped for a real sink (Pino/Datadog/etc.) later.
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends ConsoleLogger {
  private formatStructured(level: string, message: unknown, context?: string): string {
    if (process.env.NODE_ENV === "production") {
      return JSON.stringify({
        level,
        message,
        context: context ?? this.context,
        timestamp: new Date().toISOString(),
      });
    }
    return String(message);
  }

  log(message: unknown, context?: string) {
    if (process.env.NODE_ENV === "production") {
      console.log(this.formatStructured("info", message, context));
      return;
    }
    super.log(message, context ?? this.context ?? "");
  }

  error(message: unknown, stack?: string, context?: string) {
    if (process.env.NODE_ENV === "production") {
      console.error(this.formatStructured("error", message, context), stack);
      return;
    }
    super.error(message, stack, context ?? this.context ?? "");
  }

  warn(message: unknown, context?: string) {
    if (process.env.NODE_ENV === "production") {
      console.warn(this.formatStructured("warn", message, context));
      return;
    }
    super.warn(message, context ?? this.context ?? "");
  }
}
