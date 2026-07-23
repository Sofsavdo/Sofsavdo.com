import { DomainException } from "./domain-error";

describe("DomainException", () => {
  it("maps known codes to the correct HTTP status", () => {
    expect(new DomainException("NOT_FOUND", "x").getStatus()).toBe(404);
    expect(new DomainException("FORBIDDEN", "x").getStatus()).toBe(403);
    expect(new DomainException("INVALID_CREDENTIALS", "x").getStatus()).toBe(401);
    expect(new DomainException("ALREADY_APPLIED", "x").getStatus()).toBe(409);
  });

  it("defaults to 400 for codes with no explicit mapping", () => {
    expect(new DomainException("WEAK_PASSWORD", "x").getStatus()).toBe(400);
  });

  it("carries the code and optional details through", () => {
    const err = new DomainException("FORBIDDEN", "no", { required: ["payout.approve"] });
    expect(err.code).toBe("FORBIDDEN");
    expect(err.details).toEqual({ required: ["payout.approve"] });
  });
});
