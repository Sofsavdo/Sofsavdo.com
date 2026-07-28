import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, catchError, tap, throwError } from "rxjs";
import { AppLogger } from "../logging/app-logger.service";
import type { AuthenticatedUser } from "../guards/jwt-auth.guard";

type RequestWithContext = Request & { requestId?: string; user?: AuthenticatedUser };

// One structured access-log line per request (success or failure), carrying exactly the fields
// Phase 14 §7 asks for: request ID, user ID, creator ID, route params (which cover order/payment/
// campaign IDs on the routes that have them), operation name, duration, result, and — on failure —
// the HTTP status. Deliberately never logs the request body, query string, or headers: those are
// where a password/token/payment field could end up, and the fix that actually holds up over time
// is "this logger structurally cannot see that data", not "remember to redact these field names".
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext("HTTP");
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => this.log(req, res.statusCode, start, "success")),
      catchError((err: unknown) => {
        const statusCode = err instanceof HttpException ? err.getStatus() : 500;
        this.log(req, statusCode, start, "error");
        return throwError(() => err);
      }),
    );
  }

  private log(req: RequestWithContext, statusCode: number, start: number, result: "success" | "error") {
    this.logger.log({
      requestId: req.requestId,
      // Express's own types leave req.route loosely typed (effectively `any`) — cast to the one
      // field actually read here rather than letting that looseness spread into this file.
      operation: `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`,
      params: req.params,
      statusCode,
      durationMs: Date.now() - start,
      result,
      userId: req.user?.userId,
      creatorId: req.user?.creatorId,
    });
  }
}
