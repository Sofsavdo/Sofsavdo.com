import { WebhookErrorReportingAdapter } from "./webhook-error-reporting.adapter";

describe("WebhookErrorReportingAdapter", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs a JSON payload carrying the error message, truncated stack, and full context to the configured webhook", () => {
    const adapter = new WebhookErrorReportingAdapter("https://hooks.example.com/errors");
    const err = new Error("boom");
    adapter.report(err, { requestId: "req1", statusCode: 500, code: "INTERNAL_ERROR", method: "GET", path: "/orders/1", userId: "user1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.example.com/errors",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ message: "boom", requestId: "req1", statusCode: 500, code: "INTERNAL_ERROR", method: "GET", path: "/orders/1", userId: "user1" });
  });

  it("never throws when the webhook delivery itself fails — reporting an error must not create a second error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const adapter = new WebhookErrorReportingAdapter("https://hooks.example.com/errors");
    expect(() => adapter.report(new Error("boom"), { requestId: "req1", statusCode: 500, code: "INTERNAL_ERROR", method: "GET", path: "/x" })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("does not block the caller — report() returns synchronously without awaiting the fetch", () => {
    const adapter = new WebhookErrorReportingAdapter("https://hooks.example.com/errors");
    const start = Date.now();
    adapter.report(new Error("boom"), { requestId: "req1", statusCode: 500, code: "INTERNAL_ERROR", method: "GET", path: "/x" });
    expect(Date.now() - start).toBeLessThan(50);
  });
});
