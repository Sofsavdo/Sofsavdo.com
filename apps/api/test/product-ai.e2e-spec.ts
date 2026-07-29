import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors homepage.e2e-spec.ts's structure. No
// ANTHROPIC_API_KEY is configured in .env.test (a real external credential the user must supply —
// see DECISIONS.md ADR-028), so this suite honestly asserts the actual unconfigured-environment
// behavior (503 AI_NOT_CONFIGURED) rather than mocking a live Claude call over HTTP.
describe("AI Product Creation Engine (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `product-ai-e2e-${Date.now()}`;
  let adminAccessToken: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(correlationIdMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    const role = await prisma.role.create({ data: { key: `admin-${suffix}`, name: "Admin" } });
    const perms = await prisma.permission.findMany({ where: { key: "product.write" } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).post("/admin/product-ai/draft").send({ shortDescription: "x" }).expect(401);
  });

  it("rejects a request with neither imageUrls nor shortDescription as VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/product-ai/draft")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({})
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns AI_NOT_CONFIGURED (503) when ANTHROPIC_API_KEY is unset — the real state of this environment", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/product-ai/draft")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ shortDescription: "a nice chair" })
      .expect(503);
    expect(res.body.code).toBe("AI_NOT_CONFIGURED");
  });
});
