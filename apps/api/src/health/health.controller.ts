import { promises as fs, constants as fsConstants } from "fs";
import * as path from "path";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationSweepService } from "../notifications/notification-sweep.service";
import type { AppConfig } from "../config/configuration";

type ComponentStatus = "up" | "down" | "skipped";

interface ComponentResult {
  status: ComponentStatus;
  message?: string;
}

// A scheduled job is only "down" once it's had a full opportunity to run and didn't — before
// that (right after boot) a null heartbeat just means "hasn't fired yet", not a failure. Set to
// 3x the sweep's own 30s interval so one slow tick never falsely reports an outage.
const JOB_STALE_MS = 90_000;

// Confirmed via Phase 14 §13's load test: without this, HealthController inherits the global
// 120-req/60s-per-IP ThrottlerGuard default like every other route, and a health probe hitting
// /health/live frequently (the exact thing a load balancer or orchestrator is supposed to do)
// starts getting 429'd under sustained load — which could make infrastructure wrongly conclude a
// perfectly healthy instance is down, purely because of its own probing frequency. Health checks
// must never be rate-limited.
@SkipThrottle()
@ApiTags("health")
@Controller("health")
export class HealthController {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationSweep: NotificationSweepService,
  ) {
    // `enableReadyCheck: false` is deliberate, not a default left alone: ioredis's readiness
    // check sends an extra command (INFO) right after CONNECT/AUTH to confirm the server is
    // ready to serve, and at least one real proxy this app is tested against (Railway's Redis
    // proxy) resets the connection when it receives that extra command before the client has
    // finished its own handshake. Disabling the check doesn't weaken the health probe itself —
    // `ping()` below still fails loudly if Redis is actually unreachable — it just stops ioredis
    // from sending a command that this environment's proxy doesn't tolerate.
    this.redis = new Redis(this.config.get<string>("redisUrl")!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 5_000,
      // A health endpoint must fail fast, not hang — bounded retries instead of ioredis's default
      // unlimited exponential backoff, so a Redis outage makes /health/ready report degraded
      // within a few seconds rather than leaving the HTTP request pending indefinitely.
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });
  }

  // Liveness: "is the process up" — no dependency checks, so an infra probe restarting the pod
  // never gets confused by a transient DB blip that readiness would correctly report instead.
  @Public()
  @Get("live")
  live() {
    return { status: "ok" };
  }

  // Readiness: "is this instance able to serve traffic". Only Postgres is a hard blocker here —
  // a load balancer must stop routing to an instance that can't reach the database. Redis going
  // down must NOT flip this to unready: rate limiting / caching degrade, but the core order and
  // payment flows (which don't depend on Redis) keep working, so the instance stays "ready",
  // just reported as "degraded" rather than "ok". This replaces the previous @nestjs/terminus
  // HealthCheckService.check() aggregation, which returned 503 the moment ANY indicator —
  // Redis included — went down, contradicting that requirement.
  //
  // Sets the status code directly via @Res({passthrough:true}) rather than throwing
  // ServiceUnavailableException(body): AllExceptionsFilter normalizes every thrown HttpException
  // into its own generic {statusCode,code,message,requestId} shape, which has no field for a
  // plain object body like {database,redis} — it fell back to the exception's default
  // "Service Unavailable Exception" string, silently discarding exactly the diagnostic detail
  // this endpoint exists to report (confirmed by hitting a real running instance during a genuine
  // database outage: the 503 body carried no indication of which dependency had failed).
  @Public()
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: Response) {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const status = database.status !== "up" ? "down" : redis.status !== "up" ? "degraded" : "ok";
    if (database.status !== "up") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status, database, redis };
  }

  // A deeper, informational status endpoint for dashboards/on-call — not meant to gate load
  // balancer routing (that's /ready), so it always returns 200 and lets the caller read the
  // `status` field. Never returns raw secrets: Click/notification provider fields are presence
  // booleans only.
  @Public()
  @Get("status")
  async status() {
    const [database, redis, disk] = await Promise.all([this.checkDatabase(), this.checkRedis(), this.checkDisk()]);
    const scheduledJobs = this.checkScheduledJobs();
    const click = this.checkClickConfig();
    const notificationProviders = this.checkNotificationProviders();

    const criticalDown = database.status !== "up";
    const degraded = [redis, disk, scheduledJobs].some((c) => c.status === "down" || c.status === "degraded");
    const status = criticalDown ? "down" : degraded ? "degraded" : "ok";

    return {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      nodeEnv: this.config.get<string>("nodeEnv"),
      database,
      redis,
      disk,
      scheduledJobs,
      click,
      notificationProviders,
    };
  }

  private async checkDatabase(): Promise<ComponentResult> {
    // NOT @nestjs/terminus's PrismaHealthIndicator.pingCheck() — it tries a Mongo-only
    // `$runCommandRaw({ping:1})` first and only falls back to `SELECT 1` if the resulting
    // error's message contains the exact string "Use the mongodb provider". Prisma 7's
    // generated Postgres client doesn't throw that message (confirmed by direct testing: this
    // caused pingCheck to report the database DOWN while `SELECT 1` against the same
    // PrismaService instance succeeded immediately), so a real, healthy database was reported
    // as unavailable. A plain raw query against our own PrismaService is simpler and correct.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up" };
    } catch (err) {
      return { status: "down", message: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ComponentResult> {
    try {
      await this.redis.connect();
      await this.redis.ping();
      return { status: "up" };
    } catch (err) {
      return { status: "down", message: (err as Error).message };
    } finally {
      this.redis.disconnect();
    }
  }

  private async checkDisk(): Promise<ComponentResult & { driver: string }> {
    const driver = this.config.get<string>("storage.driver")!;
    if (driver !== "local") {
      // A cloud storage adapter (S3/R2/GCS) has its own availability separate from this process's
      // local filesystem — nothing useful to check here once that's the configured driver.
      return { status: "skipped", driver };
    }
    const localDir = path.resolve(this.config.get<string>("storage.localDir")!);
    try {
      await fs.mkdir(localDir, { recursive: true });
      await fs.access(localDir, fsConstants.W_OK);
      return { status: "up", driver };
    } catch (err) {
      return { status: "down", driver, message: (err as Error).message };
    }
  }

  private checkScheduledJobs(): { status: ComponentStatus | "degraded"; lastRunAt: string | null; lastError: string | null } {
    const { lastRunAt, lastError } = this.notificationSweep.getHeartbeat();
    const bootedLongEnoughToHaveRun = process.uptime() * 1000 > JOB_STALE_MS;
    const stale = lastRunAt ? Date.now() - lastRunAt.getTime() > JOB_STALE_MS : bootedLongEnoughToHaveRun;
    const status = stale ? "down" : lastError ? "degraded" : "up";
    return { status, lastRunAt: lastRunAt ? lastRunAt.toISOString() : null, lastError };
  }

  // Presence only — never the actual merchantId/serviceId/secretKey values, per Phase 14 §1's
  // "secrets never logged (or otherwise exposed)" requirement extended to this endpoint too.
  private checkClickConfig(): { merchantIdConfigured: boolean; serviceIdConfigured: boolean; secretConfigured: boolean; env: string } {
    const click = this.config.get<AppConfig["payments"]["click"]>("payments.click")!;
    return {
      merchantIdConfigured: Boolean(click.merchantId),
      serviceIdConfigured: Boolean(click.serviceId),
      secretConfigured: Boolean(click.secretKey),
      env: click.env,
    };
  }

  private checkNotificationProviders(): { telegramConfigured: boolean; emailConfigured: boolean } {
    const notifications = this.config.get<AppConfig["notifications"]>("notifications")!;
    return {
      telegramConfigured: Boolean(notifications.telegram.botToken),
      emailConfigured: Boolean(notifications.email.smtpHost),
    };
  }
}
