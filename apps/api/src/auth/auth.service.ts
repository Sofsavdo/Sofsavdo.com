import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { RolesService } from "../roles/roles.service";
import { ReferralsService } from "../referrals/referrals.service";
import { DomainException } from "../common/errors/domain-error";
import { AppLogger } from "../common/logging/app-logger.service";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import type { RegisterDto } from "./dto/register.dto";
import type { RegisterBuyerDto } from "./dto/register-buyer.dto";
import type { LoginDto } from "./dto/login.dto";

interface PasswordResetPayload {
  sub: string;
  purpose: "password_reset";
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    roleKeys: string[];
    permissions: string[];
    creatorId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokens: TokenService,
    private roles: RolesService,
    private referrals: ReferralsService,
    private jwt: JwtService,
    private config: ConfigService,
    private logger: AppLogger,
    private events: EventEmitter2,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new DomainException("EMAIL_TAKEN", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new DomainException("PHONE_TAKEN", "Bu telefon raqami allaqachon ro'yxatdan o'tgan.");
    }

    const passwordHash = await argon2.hash(dto.password);

    // Referral attribution (6B Enhancement) happens here and only here — this is the sole write
    // path that ever creates a CreatorReferral row, which is how "no attribution after
    // registration is already complete" and "one immutable direct referrer" are enforced: there
    // is simply no other API surface that can set it. Everything below runs in one transaction
    // so a referral row is never created without its CreatorProfile, or vice versa.
    const userId = await this.prisma.$transaction(async (tx) => {
      const referrer = await this.referrals.resolveReferrerForAttribution(dto.referralCode, tx);
      const referralCode = await this.referrals.generateUniqueReferralCode(tx);

      // A DRAFT CreatorApplication is created in the same write as the CreatorProfile — every
      // real creator account has one from the moment of registration, exactly like the mock (see
      // DECISIONS.md ADR-012). This keeps `CreatorUser.application` a non-nullable invariant
      // across both admin- and creator-facing session reads, rather than pushing null-handling
      // everywhere.
      const user = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          creatorProfile: {
            create: {
              displayName: dto.displayName,
              contentNiches: [],
              referralCode,
              applications: { create: { status: "DRAFT", formData: {} } },
            },
          },
        },
        include: { creatorProfile: true },
      });

      if (referrer && user.creatorProfile) {
        await this.referrals.attributeAtRegistration(tx, user.creatorProfile.id, referrer);
      }

      return user.id;
    });

    // emitAsync, not emit — see creator-applications.service.ts's identical comment. Without this,
    // a caller (or a test) checking for the resulting welcome notification/email immediately after
    // register() returns can race NotificationEventsListener's own async DB writes.
    await this.events.emitAsync(NOTIFICATION_EVENTS.USER_REGISTERED, { userId, displayName: dto.displayName });
    return this.issueSession(userId);
  }

  // Buyer self-registration — a deliberately separate method from register() above, not a shared
  // "role" branch: register() unconditionally creates a CreatorProfile + DRAFT CreatorApplication,
  // which a buyer must never get. A plain User row is the entire buyer "profile" — every
  // authenticated User can act as a buyer with no separate approval gate, unlike Creator (see
  // DECISIONS.md's Buyer Accounts ADR).
  async registerBuyer(dto: RegisterBuyerDto): Promise<AuthResult> {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new DomainException("EMAIL_TAKEN", "Bu email allaqachon ro'yxatdan o'tgan.");
    }
    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new DomainException("PHONE_TAKEN", "Bu telefon raqami allaqachon ro'yxatdan o'tgan.");
    }

    const passwordHash = await argon2.hash(dto.password);

    const userId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, phone: dto.phone, displayName: dto.fullName, passwordHash },
      });

      // Reconciliation: if this phone number already placed a guest order before this account
      // existed, link that Customer row to the new User now, rather than leaving it a permanently
      // orphaned guest record the buyer can never see in their own order history. A Customer row
      // is never duplicated — only ever linked, once, the first time a real account claims it.
      if (dto.phone) {
        const guestCustomer = await tx.customer.findFirst({ where: { phone: dto.phone, userId: null } });
        if (guestCustomer) {
          await tx.customer.update({ where: { id: guestCustomer.id }, data: { userId: user.id } });
        }
      }

      return user.id;
    });

    await this.events.emitAsync(NOTIFICATION_EVENTS.USER_REGISTERED, { userId, displayName: dto.fullName });
    return this.issueSession(userId);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    if (!dto.email && !dto.phone) {
      throw new DomainException("VALIDATION_ERROR", "Email yoki telefon raqami kiritilishi shart.");
    }
    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
    });
    if (!user) throw new DomainException("INVALID_CREDENTIALS", "Email/parol noto'g'ri.");
    if (user.status === "SUSPENDED") throw new DomainException("FORBIDDEN", "Hisobingiz vaqtincha bloklangan.");
    // BLOCKED (Phase 12, Admin Operations) — a more severe, permanent-until-admin-reverses status
    // than SUSPENDED, so it gets its own message rather than reusing SUSPENDED's "vaqtincha"
    // (temporary) wording. Same FORBIDDEN code/status as SUSPENDED — the frontend doesn't need to
    // distinguish them, both just mean "you cannot log in right now."
    if (user.status === "BLOCKED") throw new DomainException("FORBIDDEN", "Hisobingiz bloklangan.");
    if (user.status === "DELETED") throw new DomainException("INVALID_CREDENTIALS", "Email/parol noto'g'ri.");

    // Per-account brute-force lockout (Phase A) — a sibling mitigation to the per-IP
    // ThrottlerGuard limits already on this route, which alone don't slow a distributed attempt
    // spread across many IPs against one account. Checked before the password verify so a locked
    // account never pays the (slow, by design) argon2 cost on every retry.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new DomainException("ACCOUNT_LOCKED", "Ko'p muvaffaqiyatsiz urinish sababli hisobingiz vaqtincha bloklangan. Birozdan so'ng qayta urinib ko'ring.");
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.registerFailedLoginAttempt(user.id, user.failedLoginCount);
      throw new DomainException("INVALID_CREDENTIALS", "Email/parol noto'g'ri.");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
    return this.issueSession(user.id);
  }

  // Guarded on failedLoginCount matching what was just read — same race-safety shape as every
  // other concurrent-mutation guard in this codebase (see CommissionsService.approve). Unlike a
  // financial ledger, an occasional lost race here just means one attempt's increment is absorbed
  // into whichever concurrent request's update committed first — the count is a security signal,
  // not money, so a rare undercount under true concurrent login attempts is an acceptable
  // trade-off for never needing a transaction here.
  private async registerFailedLoginAttempt(userId: string, currentCount: number): Promise<void> {
    const maxAttempts = this.config.get<number>("auth.maxFailedLoginAttempts")!;
    const lockoutMinutes = this.config.get<number>("auth.lockoutDurationMinutes")!;
    const nextCount = currentCount + 1;
    await this.prisma.user.updateMany({
      where: { id: userId, failedLoginCount: currentCount },
      data: {
        failedLoginCount: nextCount,
        lockedUntil: nextCount >= maxAttempts ? new Date(Date.now() + lockoutMinutes * 60_000) : undefined,
      },
    });
  }

  async refresh(presentedRefreshToken: string): Promise<AuthResult> {
    const { userId, refreshToken } = await this.tokens.rotateRefreshToken(presentedRefreshToken);
    const accessToken = this.tokens.signAccessToken(userId);
    const summary = await this.getSessionSummary(userId);
    return { accessToken, refreshToken, user: summary };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllRefreshTokens(userId);
  }

  async getSessionSummary(userId: string): Promise<AuthResult["user"]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { creatorProfile: true },
    });
    if (!user) throw new DomainException("NOT_FOUND", "Foydalanuvchi topilmadi.");
    const { roleKeys, permissions } = await this.roles.getRoleKeysAndPermissionsForUser(userId);
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roleKeys,
      permissions,
      creatorId: user.creatorProfile?.id ?? null,
    };
  }

  // Always returns success regardless of whether the email exists — prevents account
  // enumeration via response-shape/timing. Reset delivery goes through the real Phase 10 email
  // channel now (see NotificationsService.dispatchPasswordReset, which bypasses preference-gating
  // entirely — a password reset is security-critical and explicitly user-initiated). The log line
  // below predates Phase 10 and stays as a local-dev fallback for when SMTP isn't configured at
  // all (see Phase 6 §25's "Email/Telegram provider credential bo'lmasa logging/mock adapter
  // ishlat", the precedent this domain's whole never-fake-success philosophy is built on).
  //
  // CRITICAL fix (6A→6B architecture audit): this used to log the raw reset token
  // unconditionally. A password-reset token is a bearer credential — anyone who can read
  // application logs could use it to take over the account. The token itself is never logged in
  // production; only that a reset was requested. Development environments still get the full
  // token logged so the flow is testable end-to-end without a real email provider.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = this.jwt.sign(
      { sub: user.id, purpose: "password_reset" } satisfies PasswordResetPayload,
      { secret: this.config.get<string>("jwt.accessSecret"), expiresIn: "15m" },
    );
    if (this.config.get<string>("nodeEnv") === "production") {
      this.logger.log(`Password reset requested for ${email}`);
    } else {
      this.logger.log(`Password reset requested for ${email} — dev token: ${token}`);
    }
    const resetUrl = `${this.config.get<string>("webAppUrl")}/creator/forgot-password?token=${token}`;
    await this.events.emitAsync(NOTIFICATION_EVENTS.PASSWORD_RESET_REQUESTED, { userId: user.id, resetUrl });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: PasswordResetPayload;
    try {
      payload = this.jwt.verify<PasswordResetPayload>(token, {
        secret: this.config.get<string>("jwt.accessSecret"),
      });
    } catch {
      throw new DomainException("TOKEN_EXPIRED", "Parolni tiklash havolasi yaroqsiz yoki muddati tugagan.");
    }
    if (payload.purpose !== "password_reset") {
      throw new DomainException("VALIDATION_ERROR", "Yaroqsiz token turi.");
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } });
    await this.tokens.revokeAllRefreshTokens(payload.sub);
  }

  private async issueSession(userId: string): Promise<AuthResult> {
    const accessToken = this.tokens.signAccessToken(userId);
    const refreshToken = await this.tokens.issueRefreshToken(userId);
    const user = await this.getSessionSummary(userId);
    return { accessToken, refreshToken, user };
  }
}
