import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedUser } from "./jwt-auth.guard";

function buildContext(): ExecutionContext {
  return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
}

const baseUser: AuthenticatedUser = {
  userId: "u1",
  email: "buyer@sofsavdo.com",
  phone: null,
  roleKeys: [],
  permissions: [],
  creatorId: null,
};

describe("JwtAuthGuard.handleRequest — @OptionalAuth() support (Phase D)", () => {
  async function makeGuard(isOptionalAuth: boolean | undefined) {
    const moduleRef = await Test.createTestingModule({ providers: [JwtAuthGuard, Reflector] }).compile();
    const guard = moduleRef.get(JwtAuthGuard);
    const reflector = moduleRef.get(Reflector);
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(isOptionalAuth);
    return guard;
  }

  describe("on a normal (non-optional) route — every route's behavior before this phase, unchanged", () => {
    it("returns the user when the token is valid", async () => {
      const guard = await makeGuard(false);
      expect(guard.handleRequest(null, baseUser, null, buildContext())).toBe(baseUser);
    });

    it("throws when there is no valid user (missing/invalid token)", async () => {
      const guard = await makeGuard(false);
      expect(() => guard.handleRequest(null, false, null, buildContext())).toThrow();
    });

    it("throws the original error when passport already produced one", async () => {
      const guard = await makeGuard(false);
      const err = new Error("boom");
      expect(() => guard.handleRequest(err, false, null, buildContext())).toThrow("boom");
    });
  });

  describe("on an @OptionalAuth() route", () => {
    it("returns the user when a valid token was sent (a logged-in buyer checking out)", async () => {
      const guard = await makeGuard(true);
      expect(guard.handleRequest(null, baseUser, null, buildContext())).toBe(baseUser);
    });

    it("returns undefined instead of throwing when there is no token at all (a guest checking out)", async () => {
      const guard = await makeGuard(true);
      expect(guard.handleRequest(null, false, null, buildContext())).toBeUndefined();
    });

    it("returns undefined instead of throwing even when passport reports an error (e.g. an expired token)", async () => {
      const guard = await makeGuard(true);
      expect(guard.handleRequest(new Error("jwt expired"), false, null, buildContext())).toBeUndefined();
    });
  });
});
