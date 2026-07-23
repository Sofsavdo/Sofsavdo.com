import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiTags } from "@nestjs/swagger";
import Redis from "ioredis";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

@ApiTags("health")
@Controller("health")
export class HealthController {
  private redis: Redis;

  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private config: ConfigService,
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
      // unlimited exponential backoff, so a Redis outage makes /health/ready report DOWN within a
      // few seconds rather than leaving the HTTP request pending indefinitely.
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

  // Readiness: "is the process able to serve traffic" — checks the two hard dependencies
  // (Postgres, Redis) so a load balancer stops routing to an instance that can't actually work.
  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      // NOT @nestjs/terminus's PrismaHealthIndicator.pingCheck() — it tries a Mongo-only
      // `$runCommandRaw({ping:1})` first and only falls back to `SELECT 1` if the resulting
      // error's message contains the exact string "Use the mongodb provider". Prisma 7's
      // generated Postgres client doesn't throw that message (confirmed by direct testing: this
      // caused pingCheck to report the database DOWN while `SELECT 1` against the same
      // PrismaService instance succeeded immediately), so a real, healthy database was reported
      // as unavailable. A plain raw query against our own PrismaService is simpler and correct.
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: "up" } };
        } catch (err) {
          return { database: { status: "down", message: (err as Error).message } };
        }
      },
      async () => {
        try {
          await this.redis.connect();
          await this.redis.ping();
          return { redis: { status: "up" } };
        } catch (err) {
          return { redis: { status: "down", message: (err as Error).message } };
        } finally {
          this.redis.disconnect();
        }
      },
    ]);
  }
}
