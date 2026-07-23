/** Integration/e2e tests — require a real Postgres reachable at DATABASE_URL (docker-compose). */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: ".e2e-spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  // The test Postgres used during Phase 6A verification sits behind a proxy (Railway) with
  // noticeably higher and occasionally spiky per-round-trip latency than a local database —
  // 30s was tight enough that rbac.e2e-spec.ts's beforeAll (37 permission upserts + 3 roles)
  // timed out on a real run. 60s gives headroom without masking a genuinely hung test.
  testTimeout: 60_000,
};
