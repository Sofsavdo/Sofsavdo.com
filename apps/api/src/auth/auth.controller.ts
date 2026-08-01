import { Body, Controller, Post, Get, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { RegisterBuyerDto } from "./dto/register-buyer.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const REFRESH_COOKIE = "refreshToken";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>("nodeEnv") === "production",
      sameSite: "lax",
      path: "/auth",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  // HIGH-priority fix (6A→6B architecture audit): the only rate limiting on this route used to
  // be the global default (120 req/60s per IP, app.module.ts) — permissive enough to make
  // credential-stuffing or password-guessing against /auth/login trivial. SECURITY.md explicitly
  // requires rate limiting on login/forgot-password; this was the gap. 10/min is generous for a
  // real user (a handful of typos) and materially slows a brute-force attempt. Per-account
  // lockout with backoff is tracked as follow-up technical debt (see the architecture review),
  // not implemented here — it needs a failed-attempt counter this phase doesn't have yet.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  // Deliberately a separate route from /auth/register, not a `role` field on one endpoint — see
  // AuthService.registerBuyer's own comment for why (register() unconditionally creates a
  // CreatorProfile, which a buyer must never get).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post("register-buyer")
  async registerBuyer(@Body() dto: RegisterBuyerDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.registerBuyer(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body?: { refreshToken?: string }) {
    // Try to get refresh token from cookie first, then from request body
    const token = this.readRefreshCookie(req) || body?.refreshToken;
    if (!token) throw new UnauthorizedException("Refresh token topilmadi.");
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
    return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  // Phase 14 finding: this was the one auth mutation endpoint with no route-specific limit at
  // all (register/login get 10/min, forgot-password gets 5/min) — a reset token is long and
  // random, but rate limiting the endpoint that consumes it is still cheap defense-in-depth
  // against a scripted guessing attempt, consistent with every other auth endpoint here.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  // @ApiBearerAuth('bearer') is what makes Swagger show these two routes as requiring the
  // bearer token — DocumentBuilder.addBearerAuth() in main.ts only registers the scheme, it does
  // not mark any operation as using it. Confirmed by inspecting the live /docs-json output: before
  // this decorator, /auth/me's `security` field was silently `undefined` despite the route being
  // genuinely protected by the global JwtAuthGuard. Every future controller with protected routes
  // must apply this the same way @Public() is applied to opt OUT of auth.
  @ApiBearerAuth("bearer")
  @Post("logout-all")
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.userId);
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
    return { ok: true };
  }

  @ApiBearerAuth("bearer")
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getSessionSummary(user.userId);
  }
}
