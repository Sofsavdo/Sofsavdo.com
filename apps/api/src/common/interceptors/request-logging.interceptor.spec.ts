import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { of, throwError, firstValueFrom } from "rxjs";
import { RequestLoggingInterceptor } from "./request-logging.interceptor";
import { AppLogger } from "../logging/app-logger.service";

function buildContext(overrides: Partial<{ requestId: string; user: { userId: string; creatorId?: string | null }; method: string; path: string; params: Record<string, string> }> = {}) {
  const req = {
    requestId: overrides.requestId ?? "req1",
    user: overrides.user,
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/orders/abc123",
    route: { path: "/orders/:id" },
    params: overrides.params ?? { id: "abc123" },
  };
  const res = { statusCode: 200 };
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

describe("RequestLoggingInterceptor", () => {
  let logger: { setContext: jest.Mock; log: jest.Mock };
  let interceptor: RequestLoggingInterceptor;

  beforeEach(() => {
    logger = { setContext: jest.fn(), log: jest.fn() };
    interceptor = new RequestLoggingInterceptor(logger as unknown as AppLogger);
  });

  it("logs a single structured line with requestId, userId, creatorId, operation, and result on success", async () => {
    const context = buildContext({ user: { userId: "user1", creatorId: "creator1" } });
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    await firstValueFrom(interceptor.intercept(context, handler) as never);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req1",
        operation: "GET /orders/:id",
        params: { id: "abc123" },
        statusCode: 200,
        result: "success",
        userId: "user1",
        creatorId: "creator1",
      }),
    );
  });

  it("logs result: error with the exception's actual HTTP status, not the response's default 200, and rethrows unchanged", async () => {
    const context = buildContext();
    const err = new NotFoundException("not found");
    const handler: CallHandler = { handle: () => throwError(() => err) };
    await expect(firstValueFrom(interceptor.intercept(context, handler) as never)).rejects.toBe(err);
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({ result: "error", statusCode: 404 }));
  });

  it("logs statusCode 500 for a non-HttpException error", async () => {
    const context = buildContext();
    const handler: CallHandler = { handle: () => throwError(() => new Error("boom")) };
    await expect(firstValueFrom(interceptor.intercept(context, handler) as never)).rejects.toThrow("boom");
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({ result: "error", statusCode: 500 }));
  });

  it("never includes the request body, query, or headers in the log payload — only requestId/operation/params/status/duration/result/userId/creatorId", async () => {
    const context = buildContext({ user: { userId: "user1" } });
    const handler: CallHandler = { handle: () => of({ secret: "should-not-leak" }) };
    await firstValueFrom(interceptor.intercept(context, handler) as never);
    const loggedPayload = logger.log.mock.calls[0][0];
    expect(Object.keys(loggedPayload).sort()).toEqual(["creatorId", "durationMs", "operation", "params", "requestId", "result", "statusCode", "userId"]);
  });

  it("skips non-HTTP execution contexts (e.g. an RPC/WS handler) without attempting to read a request/response", () => {
    const handler: CallHandler = { handle: () => of("value") };
    const context = { getType: () => "rpc" } as unknown as ExecutionContext;
    expect(() => interceptor.intercept(context, handler)).not.toThrow();
    expect(logger.log).not.toHaveBeenCalled();
  });
});
