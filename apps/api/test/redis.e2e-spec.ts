import Redis from "ioredis";

// Real command coverage against a real Redis instance — not just "does the client report
// connected". A health check that only inspects `redis.status` can go green while the server
// silently can't actually execute commands (auth expired, wrong db selected, etc.); this suite
// proves connect, PING, SET, GET, DEL, and a clean disconnect all genuinely round-trip.
//
// `enableReadyCheck: false` is required against the Railway Redis proxy used during Phase 6A
// verification — see the matching comment in src/health/health.controller.ts and DECISIONS.md
// ADR-009 for why (ioredis's default post-connect readiness command triggers a connection reset
// on this specific proxy) and what it does/doesn't weaken (nothing: PING below still fails loudly
// if Redis is actually unreachable).
describe("Redis (e2e)", () => {
  let redis: Redis;
  const testKey = `sofsavdo:test:${Date.now()}`;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      connectTimeout: 10_000,
      // Bounded, not ioredis's default unlimited exponential backoff — a transient blip against
      // this proxy should fail this test loudly within the suite's timeout, not hang the runner
      // indefinitely retrying in the background.
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
  });

  // `quit()`, not `disconnect()`: quit() sends the QUIT command and waits for the server's
  // acknowledgement before tearing the socket down, which closes more cleanly than the abrupt
  // disconnect() (confirmed: disconnect() here left the socket/timer in a state that kept the
  // Jest process alive after all assertions had already passed).
  afterAll(async () => {
    await redis.del(testKey).catch(() => undefined);
    await redis.quit().catch(() => redis.disconnect());
  });

  it("connects", async () => {
    await expect(redis.connect()).resolves.toBeUndefined();
    expect(["connect", "ready"]).toContain(redis.status);
  });

  it("responds to PING with PONG", async () => {
    await expect(redis.ping()).resolves.toBe("PONG");
  });

  it("SET then GET round-trips a real value", async () => {
    await redis.set(testKey, "sofsavdo-phase-6a-smoke-test");
    const value = await redis.get(testKey);
    expect(value).toBe("sofsavdo-phase-6a-smoke-test");
  });

  it("DEL actually removes the key", async () => {
    const deletedCount = await redis.del(testKey);
    expect(deletedCount).toBe(1);
    const afterDelete = await redis.get(testKey);
    expect(afterDelete).toBeNull();
  });

  it("disconnects gracefully via QUIT without throwing", async () => {
    const quitClient = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      enableReadyCheck: false,
      connectTimeout: 10_000,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    await quitClient.connect();
    await expect(quitClient.quit()).resolves.toBe("OK");
  });
});
