import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { RolesService } from "../roles/roles.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AppLogger } from "../common/logging/app-logger.service";
import { LaunchBonusService } from "../launch-bonus/launch-bonus.service";

jest.mock("argon2");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    customer: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokens: { signAccessToken: jest.Mock; issueRefreshToken: jest.Mock };
  let roles: { getRoleKeysAndPermissionsForUser: jest.Mock };
  let referrals: { resolveReferrerForAttribution: jest.Mock; generateUniqueReferralCode: jest.Mock; attributeAtRegistration: jest.Mock };
  let events: { emitAsync: jest.Mock };
  let config: { get: jest.Mock };
  let launchBonus: { createBonusForCreatorInTransaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      customer: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => unknown) => cb(prisma));
    tokens = { signAccessToken: jest.fn().mockReturnValue("access-token"), issueRefreshToken: jest.fn().mockResolvedValue("refresh-token") };
    roles = { getRoleKeysAndPermissionsForUser: jest.fn().mockResolvedValue({ roleKeys: [], permissions: [] }) };
    referrals = {
      resolveReferrerForAttribution: jest.fn().mockResolvedValue(null),
      generateUniqueReferralCode: jest.fn().mockResolvedValue("ref-abc123"),
      attributeAtRegistration: jest.fn(),
    };
    events = { emitAsync: jest.fn().mockResolvedValue([]) };
    launchBonus = { createBonusForCreatorInTransaction: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) =>
        key === "webAppUrl"
          ? "https://sofsavdo.com"
          : key === "jwt.accessSecret"
            ? "secret"
            : key === "nodeEnv"
              ? "test"
              : key === "auth.maxFailedLoginAttempts"
                ? 5
                : key === "auth.lockoutDurationMinutes"
                  ? 15
                  : undefined,
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
        { provide: RolesService, useValue: roles },
        { provide: ReferralsService, useValue: referrals },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue("reset-jwt"), verify: jest.fn() } },
        { provide: ConfigService, useValue: config },
        { provide: AppLogger, useValue: { setContext: jest.fn(), log: jest.fn() } },
        { provide: EventEmitter2, useValue: events },
        { provide: LaunchBonusService, useValue: launchBonus },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("emits user.registered with the new user's id and chosen display name", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // EMAIL_TAKEN pre-check
        .mockResolvedValueOnce({ id: "user1", email: "aziz@example.uz", phone: null, creatorProfile: { id: "creator1" } }); // issueSession -> getSessionSummary
      prisma.user.create.mockResolvedValue({ id: "user1", creatorProfile: { id: "creator1" } });

      await service.register({ email: "aziz@example.uz", password: "Str0ngPass!", displayName: "Aziz Karimov" });

      expect(events.emitAsync).toHaveBeenCalledWith("user.registered", { userId: "user1", displayName: "Aziz Karimov" });
    });
  });

  describe("registerBuyer", () => {
    it("throws EMAIL_TAKEN when the email is already registered", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: "existing" });
      await expect(
        service.registerBuyer({ email: "buyer@example.uz", password: "Str0ngPass!", fullName: "Malika" }),
      ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    });

    it("creates a plain User with no creatorProfile field in the create() call", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // email pre-check
        .mockResolvedValueOnce({ id: "user1", email: null, phone: "+998901234567", creatorProfile: null }); // issueSession
      prisma.user.create.mockResolvedValue({ id: "user1" });
      prisma.customer.findFirst.mockResolvedValue(null);

      await service.registerBuyer({ phone: "+998901234567", password: "Str0ngPass!", fullName: "Malika Yusupova" });

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data).not.toHaveProperty("creatorProfile");
      expect(createArgs.data).toMatchObject({ phone: "+998901234567", displayName: "Malika Yusupova" });
    });

    it("links a pre-existing guest Customer row matching this phone (merge, not duplicate)", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user1", email: null, phone: "+998901234567", creatorProfile: null });
      prisma.user.create.mockResolvedValue({ id: "user1" });
      prisma.customer.findFirst.mockResolvedValue({ id: "guest-customer-1", phone: "+998901234567", userId: null });

      await service.registerBuyer({ phone: "+998901234567", password: "Str0ngPass!", fullName: "Malika Yusupova" });

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({ where: { phone: "+998901234567", userId: null } });
      expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: "guest-customer-1" }, data: { userId: "user1" } });
    });

    it("does not touch Customer at all when no guest row matches this phone", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user1", email: null, phone: "+998901234567", creatorProfile: null });
      prisma.user.create.mockResolvedValue({ id: "user1" });
      prisma.customer.findFirst.mockResolvedValue(null);

      await service.registerBuyer({ phone: "+998901234567", password: "Str0ngPass!", fullName: "Malika Yusupova" });

      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it("emits user.registered with the new user's id and full name", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user1", email: "buyer@example.uz", phone: null, creatorProfile: null });
      prisma.user.create.mockResolvedValue({ id: "user1" });
      prisma.customer.findFirst.mockResolvedValue(null);

      await service.registerBuyer({ email: "buyer@example.uz", password: "Str0ngPass!", fullName: "Malika Yusupova" });

      expect(events.emitAsync).toHaveBeenCalledWith("user.registered", { userId: "user1", displayName: "Malika Yusupova" });
    });
  });

  describe("forgotPassword", () => {
    it("emits password_reset.requested with a reset URL built from the signed token", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "user1", email: "aziz@example.uz" });

      await service.forgotPassword("aziz@example.uz");

      expect(events.emitAsync).toHaveBeenCalledWith("password_reset.requested", { userId: "user1", resetUrl: "https://sofsavdo.com/creator/forgot-password?token=reset-jwt" });
    });

    it("does not emit anything for an email that doesn't exist (no account-enumeration signal)", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await service.forgotPassword("nobody@example.uz");
      expect(events.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe("login — brute-force lockout", () => {
    const baseUser = {
      id: "user1",
      email: "aziz@example.uz",
      phone: null,
      passwordHash: "hash",
      status: "ACTIVE" as const,
      failedLoginCount: 0,
      lockedUntil: null,
      creatorProfile: { id: "creator1" },
    };

    it("resets failedLoginCount/lockedUntil to 0/null on a successful login", async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      prisma.user.findUnique.mockResolvedValue(baseUser); // issueSession -> getSessionSummary
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ email: "aziz@example.uz", password: "correct" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user1" },
        data: { lastLoginAt: expect.any(Date), failedLoginCount: 0, lockedUntil: null },
      });
    });

    it("increments failedLoginCount on a wrong password, guarded on the count just read", async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: "aziz@example.uz", password: "wrong" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user1", failedLoginCount: 0 },
        data: { failedLoginCount: 1, lockedUntil: undefined },
      });
    });

    it("sets lockedUntil once the failure count reaches the configured threshold", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, failedLoginCount: 4 });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: "aziz@example.uz", password: "wrong" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user1", failedLoginCount: 4 },
        data: { failedLoginCount: 5, lockedUntil: expect.any(Date) },
      });
    });

    it("rejects a locked account before even checking the password, without a fresh argon2 verify", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, lockedUntil: new Date(Date.now() + 10 * 60_000) });

      await expect(service.login({ email: "aziz@example.uz", password: "whatever" })).rejects.toMatchObject({ code: "ACCOUNT_LOCKED" });
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it("allows login again once lockedUntil has passed", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, lockedUntil: new Date(Date.now() - 1000), failedLoginCount: 5 });
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ email: "aziz@example.uz", password: "correct" })).resolves.toBeDefined();
    });
  });
});
