import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationSweepService } from "../notifications/notification-sweep.service";

const THROTTLER_SKIP = "THROTTLER:SKIP";

function mockResponse() {
  const res = { statusCode: 200, status: jest.fn() };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res as unknown as import("express").Response & { statusCode: number; status: jest.Mock };
}

const redisInstances: Array<{ connect: jest.Mock; ping: jest.Mock; disconnect: jest.Mock }> = [];

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => {
    const instance = { connect: jest.fn().mockResolvedValue(undefined), ping: jest.fn().mockResolvedValue("PONG"), disconnect: jest.fn() };
    redisInstances.push(instance);
    return instance;
  });
});

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let notificationSweep: { getHeartbeat: jest.Mock };
  let redisInstance: (typeof redisInstances)[number];

  // Not "local", so /health/status's disk check short-circuits to "skipped" without touching
  // the real filesystem — disk write-checking is exercised in the real deployed environment,
  // not in this unit test.
  const configValues: Record<string, unknown> = {
    redisUrl: "redis://localhost:6379",
    "storage.driver": "s3",
    "storage.localDir": "uploads",
    nodeEnv: "test",
    "payments.click": { merchantId: "m1", serviceId: "s1", secretKey: "k1", env: "test" },
    notifications: { telegram: { botToken: "" }, email: { smtpHost: "" } },
  };

  beforeEach(async () => {
    redisInstances.length = 0;
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) };
    notificationSweep = { getHeartbeat: jest.fn().mockReturnValue({ lastRunAt: new Date(), lastError: null }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: NotificationSweepService, useValue: notificationSweep },
      ],
    }).compile();
    controller = moduleRef.get(HealthController);
    redisInstance = redisInstances[0]!;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("live", () => {
    it("reports ok with no dependency checks", () => {
      expect(controller.live()).toEqual({ status: "ok" });
    });
  });

  // Regression test for a real bug the Phase 14 §13 load test surfaced: without @SkipThrottle(),
  // HealthController inherits the global 120-req/60s-per-IP ThrottlerGuard default like every
  // other route, so a health probe hitting /health/live at any real frequency starts getting
  // 429'd under sustained load — confirmed via a live load-test run (2317/2317 requests came back
  // 4xx before this fix, 0/2317 after). Health checks must never be rate-limited.
  it("is exempt from the global rate limiter (@SkipThrottle on the whole controller)", () => {
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}default`, HealthController)).toBe(true);
  });

  describe("ready", () => {
    it("reports ok (200, untouched status) when both database and redis are reachable", async () => {
      const res = mockResponse();
      const result = await controller.ready(res);
      expect(result).toEqual({ status: "ok", database: { status: "up" }, redis: { status: "up" } });
      expect(res.status).not.toHaveBeenCalled();
    });

    it("reports degraded (still 200, not thrown) when only redis is down — a Redis outage must not take down readiness", async () => {
      redisInstance.ping.mockRejectedValue(new Error("ECONNREFUSED"));
      const res = mockResponse();
      const result = await controller.ready(res);
      expect(result.status).toBe("degraded");
      expect(result.database).toEqual({ status: "up" });
      expect(result.redis.status).toBe("down");
      expect(res.status).not.toHaveBeenCalled();
    });

    it("sets a real 503 status AND returns the full diagnostic body (which dependency failed and why) when the database is down", async () => {
      // Regression test: this used to throw ServiceUnavailableException(body), but
      // AllExceptionsFilter normalizes every thrown HttpException into its own generic
      // {statusCode,code,message,requestId} shape, which has no field for a plain object body —
      // it silently discarded `body` and returned only "Service Unavailable Exception" (confirmed
      // against a real running instance during an actual database outage). Setting the status via
      // @Res({passthrough:true}) instead means the object below reaches the client verbatim.
      prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
      const res = mockResponse();
      const result = await controller.ready(res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(result).toEqual({ status: "down", database: { status: "down", message: "connection refused" }, redis: { status: "up" } });
    });
  });

  describe("status", () => {
    it("reports overall ok when database, redis, and scheduled jobs are all healthy", async () => {
      const result = await controller.status();
      expect(result.status).toBe("ok");
      expect(result.database).toEqual({ status: "up" });
      expect(result.redis).toEqual({ status: "up" });
      expect(result.disk).toEqual({ status: "skipped", driver: "s3" });
      expect(result.scheduledJobs.status).toBe("up");
    });

    it("reports overall degraded when redis is down but database is up", async () => {
      redisInstance.ping.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await controller.status();
      expect(result.status).toBe("degraded");
    });

    it("reports overall down when the database is down", async () => {
      prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
      const result = await controller.status();
      expect(result.status).toBe("down");
    });

    it("reports scheduled jobs as up while still within the startup grace period, even with no completed run yet", async () => {
      jest.spyOn(process, "uptime").mockReturnValue(10);
      notificationSweep.getHeartbeat.mockReturnValue({ lastRunAt: null, lastError: null });
      const result = await controller.status();
      expect(result.scheduledJobs).toEqual({ status: "up", lastRunAt: null, lastError: null });
      expect(result.status).toBe("ok");
    });

    it("reports scheduled jobs as down (and overall degraded) once booted long enough with no completed run", async () => {
      jest.spyOn(process, "uptime").mockReturnValue(200);
      notificationSweep.getHeartbeat.mockReturnValue({ lastRunAt: null, lastError: null });
      const result = await controller.status();
      expect(result.scheduledJobs.status).toBe("down");
      expect(result.status).toBe("degraded");
    });

    it("reports scheduled jobs as down when the last run is older than the staleness threshold", async () => {
      notificationSweep.getHeartbeat.mockReturnValue({ lastRunAt: new Date(Date.now() - 200_000), lastError: null });
      const result = await controller.status();
      expect(result.scheduledJobs.status).toBe("down");
    });

    it("reports scheduled jobs as degraded (not down) when the last run was recent but errored", async () => {
      notificationSweep.getHeartbeat.mockReturnValue({ lastRunAt: new Date(), lastError: "sweepOrders failed: timeout" });
      const result = await controller.status();
      expect(result.scheduledJobs).toEqual({ status: "degraded", lastRunAt: expect.any(String), lastError: "sweepOrders failed: timeout" });
      expect(result.status).toBe("degraded");
    });

    it("exposes Click configuration as presence booleans only, never the actual secret/merchant/service values", async () => {
      const result = await controller.status();
      expect(result.click).toEqual({ merchantIdConfigured: true, serviceIdConfigured: true, secretConfigured: true, env: "test" });
      expect(JSON.stringify(result)).not.toContain("m1");
      expect(JSON.stringify(result)).not.toContain("s1");
      expect(JSON.stringify(result)).not.toContain("k1");
    });

    it("exposes notification provider configuration as presence booleans only", async () => {
      const result = await controller.status();
      expect(result.notificationProviders).toEqual({ telegramConfigured: false, emailConfigured: false });
    });
  });
});
