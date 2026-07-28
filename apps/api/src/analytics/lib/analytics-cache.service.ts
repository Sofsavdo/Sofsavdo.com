import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import Redis from "ioredis";

// First real consumer of Redis in this codebase — every other use (HealthController) only pings
// it. This is a genuinely best-effort cache: a miss, a timeout, or Redis being fully unreachable
// must never fail an analytics request, only make it recompute live. Nothing here is a source of
// truth; Postgres always is. See ANALYTICS.md §4/§12 and DECISIONS.md ADR-020.
@Injectable()
export class AnalyticsCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>("redisUrl")!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false, // same proxy-reset reason as HealthController
      connectTimeout: 3_000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });
    this.redis.on("error", (err) => this.logger.warn(`Analytics cache Redis error (best-effort, ignored): ${err.message}`));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  buildKey(namespace: string, parts: Record<string, unknown>): string {
    const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
    return `analytics:${namespace}:${hash}`;
  }

  // Returns null on ANY failure (not connected, timeout, bad data) — callers always fall through
  // to a live recompute rather than propagating a cache error to the HTTP response.
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`Analytics cache read failed (falling back to live query): ${(err as Error).message}`);
      return null;
    }
  }

  // Swallows every failure the same way — a cache WRITE failing must never surface as a request
  // failure either, since the response has already been computed correctly from Postgres.
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      if (this.redis.status === "wait") await this.redis.connect();
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      this.logger.warn(`Analytics cache write failed (ignored): ${(err as Error).message}`);
    }
  }
}
