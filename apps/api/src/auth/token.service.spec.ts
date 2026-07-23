import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TokenService } from "./token.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

describe("TokenService", () => {
  let service: TokenService;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue("signed.jwt.token") } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => ({ "jwt.accessSecret": "s", "jwt.accessTtl": "15m", "jwt.refreshTtl": "30d" })[key] },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TokenService);
  });

  it("issues a refresh token and stores only its hash, never the raw value", async () => {
    const token = await service.issueRefreshToken("user-1");
    expect(token).toHaveLength(128); // 64 random bytes as hex
    const createArgs = prisma.refreshToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string };
    };
    expect(createArgs.data.userId).toBe("user-1");
    expect(createArgs.data.tokenHash).not.toBe(token);
    expect(createArgs.data.tokenHash).toHaveLength(64); // sha256 hex digest
  });

  it("rejects an unknown refresh token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotateRefreshToken("bogus")).rejects.toThrow(DomainException);
  });

  it("rejects an expired refresh token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.rotateRefreshToken("expired-token")).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("revokes ALL of a user's refresh tokens on reuse of an already-revoked token (theft response)", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "user-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100_000),
    });
    await expect(service.rotateRefreshToken("reused-token")).rejects.toMatchObject({ code: "TOKEN_REVOKED" });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rotates a valid token: revokes the old one and issues a new one in the same transaction", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt1",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100_000),
    });
    const result = await service.rotateRefreshToken("valid-token");
    expect(result.userId).toBe("user-1");
    expect(result.refreshToken).not.toBe("valid-token");
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
