import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { DomainException } from "../errors/domain-error";
import type { ErrorReportingPort } from "../error-reporting/error-reporting.port";
import { NoopErrorReportingAdapter } from "../error-reporting/noop-error-reporting.adapter";

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

// Normalizes every thrown error — DomainException, Nest's built-in HttpException subclasses,
// and truly unexpected errors — into one wire shape. Matches both API.md's original
// {statusCode,error,message,requestId} and the Phase 6 spec's {code,message,details,requestId}
// by carrying both `code` and `statusCode`.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // Not DI-managed (this class is constructed directly in main.ts, before Nest's application
  // context exists, so it can catch bootstrap-time exceptions too) — the reporting adapter is
  // built the same way and passed in, defaulting to a no-op exactly like every other optional
  // integration in this codebase (Telegram/email/storage all no-op or fail loudly per-call rather
  // than being required for the app to start).
  constructor(private readonly errorReporting: ErrorReportingPort = new NoopErrorReportingAdapter()) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string; user?: { userId?: string } }>();
    const requestId = req.requestId ?? "unknown";

    const body = this.toErrorBody(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error(`[${requestId}] ${body.message}`, exception instanceof Error ? exception.stack : undefined);
      if (exception instanceof Error) {
        this.errorReporting.report(exception, {
          requestId,
          statusCode: body.statusCode,
          code: body.code,
          method: req.method,
          path: req.path,
          userId: req.user?.userId,
        });
      }
    }
    res.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, requestId: string): ErrorBody {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === "string"
          ? response
          : Array.isArray((response as { message?: unknown }).message)
            ? ((response as { message: string[] }).message.join("; "))
            : ((response as { message?: string }).message ?? exception.message);
      return {
        statusCode: status,
        code: status === 400 ? "VALIDATION_ERROR" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : "ERROR",
        message,
        requestId,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "Kutilmagan xatolik yuz berdi.",
      requestId,
    };
  }
}
