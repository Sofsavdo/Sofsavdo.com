import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { RolesService } from "../roles/roles.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AppLogger } from "../common/logging/app-logger.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }; $transaction: jest.Mock };
  let tokens: { signAccessToken: jest.Mock; issueRefreshToken: jest.Mock };
  let roles: { getRoleKeysAndPermissionsForUser: jest.Mock };
  let referrals: { resolveReferrerForAttribution: jest.Mock; generateUniqueReferralCode: jest.Mock; attributeAtRegistration: jest.Mock };
  let events: { emitAsync: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, $transaction: jest.fn() };
    prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => unknown) => cb(prisma));
    tokens = { signAccessToken: jest.fn().mockReturnValue("access-token"), issueRefreshToken: jest.fn().mockResolvedValue("refresh-token") };
    roles = { getRoleKeysAndPermissionsForUser: jest.fn().mockResolvedValue({ roleKeys: [], permissions: [] }) };
    referrals = {
      resolveReferrerForAttribution: jest.fn().mockResolvedValue(null),
      generateUniqueReferralCode: jest.fn().mockResolvedValue("ref-abc123"),
      attributeAtRegistration: jest.fn(),
    };
    events = { emitAsync: jest.fn().mockResolvedValue([]) };
    config = { get: jest.fn((key: string) => (key === "webAppUrl" ? "https://rosti.uz" : key === "jwt.accessSecret" ? "secret" : key === "nodeEnv" ? "test" : undefined)) };

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

  describe("forgotPassword", () => {
    it("emits password_reset.requested with a reset URL built from the signed token", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user1", email: "aziz@example.uz" });

      await service.forgotPassword("aziz@example.uz");

      expect(events.emitAsync).toHaveBeenCalledWith("password_reset.requested", { userId: "user1", resetUrl: "https://rosti.uz/creator/forgot-password?token=reset-jwt" });
    });

    it("does not emit anything for an email that doesn't exist (no account-enumeration signal)", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.forgotPassword("nobody@example.uz");
      expect(events.emitAsync).not.toHaveBeenCalled();
    });
  });
});
