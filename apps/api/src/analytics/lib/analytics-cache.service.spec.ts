import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AnalyticsCacheService } from "./analytics-cache.service";

type StubbedRedis = { status: string; connect: () => Promise<void>; get: (key: string) => Promise<string | null>; set: (...args: unknown[]) => Promise<string> };

// The one hard requirement this domain has around Redis: a cache failure must NEVER surface as a
// request failure, only fall through to a live recompute. These tests stub the underlying ioredis
// client directly (rather than pointing at a real unreachable host, which leaves reconnect timers
// running past the test's lifetime) and force every failure mode, asserting the service swallows
// all of them.
describe("AnalyticsCacheService (best-effort Redis wrapper)", () => {
  let service: AnalyticsCacheService;
  let redis: StubbedRedis;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AnalyticsCacheService, { provide: ConfigService, useValue: { get: () => "redis://127.0.0.1:6379" } }],
    }).compile();
    service = moduleRef.get(AnalyticsCacheService);
    redis = (service as unknown as { redis: StubbedRedis }).redis;
    redis.status = "ready"; // skip the lazyConnect path entirely — no real socket is ever opened
  });

  it("buildKey is deterministic for the same input and different for different input", () => {
    const a = service.buildKey("executive", { range: "this_month", creatorId: "c1" });
    const b = service.buildKey("executive", { range: "this_month", creatorId: "c1" });
    const c = service.buildKey("executive", { range: "this_month", creatorId: "c2" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("get() returns null (never throws) when the client rejects", async () => {
    redis.get = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(service.get("some-key")).resolves.toBeNull();
  });

  it("set() resolves (never throws) when the client rejects", async () => {
    redis.set = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(service.set("some-key", { a: 1 }, 60)).resolves.toBeUndefined();
  });

  it("get() returns null on malformed cached JSON rather than throwing", async () => {
    redis.get = async () => "not valid json{{";
    const result = await service.get("bad-key");
    expect(result).toBeNull();
  });

  it("get() returns the parsed value on a real hit", async () => {
    redis.get = async () => JSON.stringify({ hello: "world" });
    const result = await service.get<{ hello: string }>("good-key");
    expect(result).toEqual({ hello: "world" });
  });

  it("get() returns null on a cache miss", async () => {
    redis.get = async () => null;
    const result = await service.get("missing-key");
    expect(result).toBeNull();
  });
});
