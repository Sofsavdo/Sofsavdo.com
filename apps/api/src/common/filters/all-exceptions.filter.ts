import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { DomainException } from "../errors/domain-error";

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

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? "unknown";

    const body = this.toErrorBody(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error(`[${requestId}] ${body.message}`, exception instanceof Error ? exception.stack : undefined);
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
