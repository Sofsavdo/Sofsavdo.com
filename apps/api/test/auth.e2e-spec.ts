import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";

// Requires a real Postgres reachable at process.env.DATABASE_URL — this is intentional per the
// Phase 6 spec ("Real database, migration, auth ... to'g'ri ishlayotganini ko'rib chiqamiz"):
// register/login/refresh/logout-all are exercised against actual rows, not a mocked Prisma client.

function firstSetCookie(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers["set-cookie"];
  const first = Array.isArray(cookies) ? (cookies as string[])[0] : undefined;
  if (!first) throw new Error("Expected a Set-Cookie header but got none.");
  return first;
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@rosti.uz`;
  const password = "SuperSecret123";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-" } } });
    await app.close();
  });

  it("registers a new creator and returns an access token + user summary", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, displayName: "E2E Test Creator" })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.creatorId).toEqual(expect.any(String));

    // Full cookie attribute contract per DECISIONS.md ADR-008 — HttpOnly (invisible to JS),
    // SameSite=Lax (the CSRF mitigation that ADR relies on instead of a separate CSRF token),
    // scoped to /auth (never sent on unrelated API calls). `Secure` is intentionally absent here
    // because tests run over plain HTTP (NODE_ENV=test, not production).
    const cookie = firstSetCookie(res);
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/auth/i);
  });

  it("rejects a duplicate email with a typed EMAIL_TAKEN error", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password, displayName: "Dup" })
      .expect(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  it("rejects login with the wrong password using a typed INVALID_CREDENTIALS error", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in with correct credentials and sets a refresh cookie", async () => {
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(firstSetCookie(res)).toMatch(/refreshToken=/);
  });

  it("rejects unauthenticated access to /auth/me", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("returns the session summary for an authenticated caller", async () => {
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(201);
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  // Full reuse-detection flow per the Phase 6 spec §5: login → token A → refresh A into token B
  // → reuse A → the whole token family must be revoked, so B (a legitimate, never-reused token)
  // must ALSO stop working. This is the part a plain "rotation works" test doesn't cover: reuse
  // of an old token must burn the *entire* chain, not just the one presented token.
  it("refresh token reuse detection revokes the whole token family, not just the reused token", async () => {
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(201);
    const tokenA = firstSetCookie(login);

    const refreshed = await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", tokenA).expect(201);
    const tokenB = firstSetCookie(refreshed);
    expect(tokenB).not.toBe(tokenA);

    // Step 4: reuse A (already rotated away) — must be rejected as revoked/reused.
    const reuseAttempt = await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", tokenA).expect(401);
    expect(["TOKEN_REVOKED", "UNAUTHORIZED"]).toContain(reuseAttempt.body.code);

    // Step 6: B — a legitimate, never-reused token from the same family — must now ALSO be
    // rejected, proving the theft response revoked every token for the user, not just A.
    await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", tokenB).expect(401);
  });

  it("logout-all revokes every refresh token for the user", async () => {
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(201);
    const cookie = firstSetCookie(login);

    await request(app.getHttpServer())
      .post("/auth/logout-all")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .set("Cookie", cookie)
      .expect(201);

    await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", cookie).expect(401);
  });
});
