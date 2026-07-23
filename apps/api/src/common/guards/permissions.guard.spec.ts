import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { PermissionsGuard } from "./permissions.guard";
import { DomainException } from "../errors/domain-error";
import type { AuthenticatedUser } from "./jwt-auth.guard";

function buildContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const baseUser: AuthenticatedUser = {
  userId: "u1",
  email: "a@rosti.uz",
  phone: null,
  roleKeys: ["manager"],
  permissions: ["order.read", "order.update"],
  creatorId: null,
};

describe("PermissionsGuard", () => {
  async function makeGuard(metadata: { isPublic?: boolean; permissions?: string[] }) {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();
    const guard = moduleRef.get(PermissionsGuard);
    const reflector = moduleRef.get(Reflector);
    jest.spyOn(reflector, "getAllAndOverride").mockImplementation((key: unknown) => {
      if (key === "isPublic") return metadata.isPublic;
      if (key === "permissions") return metadata.permissions;
      return undefined;
    });
    return guard;
  }

  it("allows public routes without a user", async () => {
    const guard = await makeGuard({ isPublic: true });
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it("allows routes with no required permissions once authenticated", async () => {
    const guard = await makeGuard({ permissions: [] });
    expect(guard.canActivate(buildContext(baseUser))).toBe(true);
  });

  it("throws UNAUTHORIZED when no user is attached but permissions are required", async () => {
    const guard = await makeGuard({ permissions: ["order.read"] });
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(DomainException);
  });

  it("throws FORBIDDEN when the user is missing a required permission", async () => {
    const guard = await makeGuard({ permissions: ["payout.approve"] });
    expect(() => guard.canActivate(buildContext(baseUser))).toThrow(DomainException);
  });

  it("requires ALL listed permissions, not just one", async () => {
    const guard = await makeGuard({ permissions: ["order.read", "payout.approve"] });
    expect(() => guard.canActivate(buildContext(baseUser))).toThrow(DomainException);
  });

  it("passes when the user has every required permission", async () => {
    const guard = await makeGuard({ permissions: ["order.read", "order.update"] });
    expect(guard.canActivate(buildContext(baseUser))).toBe(true);
  });
});
