import { HttpStatus, NotFoundException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { DomainException } from "../errors/domain-error";

function buildHost(requestId?: string, userId?: string) {
  const req = { requestId, user: userId ? { userId } : undefined, method: "GET", path: "/orders/123" };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, req, res };
}

describe("AllExceptionsFilter", () => {
  it("normalizes a DomainException into {statusCode, code, message, details, requestId} and does not report it (not a 5xx)", () => {
    const reporting = { report: jest.fn() };
    const filter = new AllExceptionsFilter(reporting);
    const { host, res } = buildHost("req1");
    filter.catch(new DomainException("NOT_FOUND", "Topilmadi."), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOT_FOUND", message: "Topilmadi.", requestId: "req1" }));
    expect(reporting.report).not.toHaveBeenCalled();
  });

  it("normalizes a built-in HttpException", () => {
    const filter = new AllExceptionsFilter();
    const { host, res } = buildHost("req2");
    filter.catch(new NotFoundException("gone"), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "NOT_FOUND", requestId: "req2" }));
  });

  it("normalizes a truly unexpected error to a generic 500 body and reports it via the configured ErrorReportingPort", () => {
    const reporting = { report: jest.fn() };
    const filter = new AllExceptionsFilter(reporting);
    const { host, res } = buildHost("req3", "user1");
    const err = new Error("boom");
    filter.catch(err, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "INTERNAL_ERROR", requestId: "req3" }));
    expect(reporting.report).toHaveBeenCalledWith(err, expect.objectContaining({ requestId: "req3", statusCode: 500, code: "INTERNAL_ERROR", method: "GET", path: "/orders/123", userId: "user1" }));
  });

  it("defaults to a no-op reporter when none is provided — never throws even for a 500", () => {
    const filter = new AllExceptionsFilter();
    const { host, res } = buildHost("req4");
    expect(() => filter.catch(new Error("boom"), host)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
