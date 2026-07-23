import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

export interface AccessTokenPayload {
  sub: string;
}

// Refresh tokens are opaque, high-entropy random strings (never a JWT — nothing to decode,
// nothing to leak) stored server-side only as a SHA-256 lookup hash. SHA-256 (not Argon2) is
// deliberate here: the token itself already has 256 bits of entropy, so it isn't guessable the
// way a human password is, and a deterministic hash is what makes an indexed `tokenHash` unique
// lookup possible at all — Argon2's per-call salt would make that lookup impossible without a
// full-table scan.
@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  signAccessToken(userId: string): string {
    const payload: AccessTokenPayload = { sub: userId };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessTtl") as string,
    } as Parameters<JwtService["sign"]>[1]);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshTtlMs(): number {
    const ttl = this.config.get<string>("jwt.refreshTtl") ?? "30d";
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const [, amountRaw, unit] = match as unknown as [string, string, string];
    const amount = Number(amountRaw);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
    return amount * unitMs;
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    return token;
  }

  // Rotation: the presented refresh token is revoked and a new one is issued in the same
  // transaction. If the presented token is found but already revoked, that is a signal of
  // token reuse (theft/replay) — per spec §7 "revoked token handling", every refresh token
  // belonging to that user is revoked as a precaution and the caller must log in again.
  async rotateRefreshToken(presentedToken: string): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = this.hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new DomainException("UNAUTHORIZED", "Refresh token yaroqsiz.");
    }
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new DomainException("TOKEN_REVOKED", "Token qayta ishlatildi — barcha sessiyalar tugatildi, qayta kiring.");
    }
    if (existing.expiresAt < new Date()) {
      throw new DomainException("TOKEN_EXPIRED", "Refresh token muddati tugagan.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
      const newToken = randomBytes(64).toString("hex");
      await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: this.hashToken(newToken),
          expiresAt: new Date(Date.now() + this.refreshTtlMs()),
        },
      });
      return { userId: existing.userId, refreshToken: newToken };
    });
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
