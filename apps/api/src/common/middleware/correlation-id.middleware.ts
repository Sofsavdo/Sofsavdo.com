import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Express middleware, NOT a Nest interceptor — this must run before Guards, and Nest's pipeline
// order is Middleware -> Guards -> Interceptors -> Pipes -> Handler. An interceptor-based version
// of this (the original implementation) never ran for any request a Guard rejected — which is
// every 401/403, the single most common error case — leaving AllExceptionsFilter's requestId
// fallback of "unknown" on exactly the responses where a correlation ID matters most. Confirmed
// by hitting a real running instance: GET /auth/me with no token returned
// {"requestId":"unknown"} before this fix.
export function correlationIdMiddleware(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"]?.toString() ?? randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
