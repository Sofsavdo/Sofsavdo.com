import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors offers.e2e-spec.ts's structure. Creates its own
// ADMIN-roled user (homepage.read/homepage.write) so this suite is self-contained.
describe("Homepage CMS (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `homepage-e2e-${Date.now()}`;
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
    const perms = await prisma.permission.findMany({ where: { key: { in: ["homepage.read", "homepage.write"] } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);
  });

  afterAll(async () => {
    await prisma.homepageSection.deleteMany({});
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("GET /homepage (public)", () => {
    it("requires no authentication", async () => {
      await request(app.getHttpServer()).get("/homepage").expect(200);
    });

    it("returns [] when no sections exist", async () => {
      const res = await request(app.getHttpServer()).get("/homepage").expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("admin CRUD", () => {
    it("rejects an unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/admin/homepage-sections").expect(401);
    });

    it("full add -> list -> update -> toggle -> reorder -> remove cycle", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };

      const created = await request(app.getHttpServer())
        .post("/admin/homepage-sections")
        .set(authHeader)
        .send({ type: "FAQ", content: { heading: "Savollar", items: [] } })
        .expect(201);
      expect(created.body.type).toBe("FAQ");
      expect(created.body.isActive).toBe(true);
      const id = created.body.id as string;

      const list = await request(app.getHttpServer()).get("/admin/homepage-sections").set(authHeader).expect(200);
      expect(list.body.some((s: { id: string }) => s.id === id)).toBe(true);

      const updated = await request(app.getHttpServer())
        .patch(`/admin/homepage-sections/${id}`)
        .set(authHeader)
        .send({ content: { heading: "Yangilangan", items: [] } })
        .expect(200);
      expect(updated.body.content.heading).toBe("Yangilangan");

      const toggled = await request(app.getHttpServer())
        .patch(`/admin/homepage-sections/${id}`)
        .set(authHeader)
        .send({ isActive: false })
        .expect(200);
      expect(toggled.body.isActive).toBe(false);

      await request(app.getHttpServer()).post("/admin/homepage-sections/reorder").set(authHeader).send({ orderedIds: [id] }).expect(201);

      await request(app.getHttpServer()).delete(`/admin/homepage-sections/${id}`).set(authHeader).expect(204);

      const afterDelete = await request(app.getHttpServer()).get("/admin/homepage-sections").set(authHeader).expect(200);
      expect(afterDelete.body.some((s: { id: string }) => s.id === id)).toBe(false);
    });
  });

  describe("public filtering — the reason listPublic exists at all", () => {
    it("never includes an inactive, scheduled, or expired section, and drops admin-only fields", async () => {
      const authHeader = { Authorization: `Bearer ${adminAccessToken}` };
      const now = Date.now();

      const live = await request(app.getHttpServer())
        .post("/admin/homepage-sections")
        .set(authHeader)
        .send({ type: "CUSTOM_RICH_TEXT", content: { text: "live-section-marker" } })
        .expect(201);
      const inactive = await request(app.getHttpServer())
        .post("/admin/homepage-sections")
        .set(authHeader)
        .send({ type: "CUSTOM_RICH_TEXT", content: { text: "inactive-marker" }, isActive: false })
        .expect(201);
      const scheduled = await request(app.getHttpServer())
        .post("/admin/homepage-sections")
        .set(authHeader)
        .send({ type: "CUSTOM_RICH_TEXT", content: { text: "scheduled-marker" }, startsAt: new Date(now + 1_000_000).toISOString() })
        .expect(201);
      const expired = await request(app.getHttpServer())
        .post("/admin/homepage-sections")
        .set(authHeader)
        .send({ type: "CUSTOM_RICH_TEXT", content: { text: "expired-marker" }, expiresAt: new Date(now - 1_000_000).toISOString() })
        .expect(201);

      const res = await request(app.getHttpServer()).get("/homepage").expect(200);
      const texts = res.body.map((s: { content: { text: string } }) => s.content.text);
      expect(texts).toContain("live-section-marker");
      expect(texts).not.toContain("inactive-marker");
      expect(texts).not.toContain("scheduled-marker");
      expect(texts).not.toContain("expired-marker");
      expect(res.body[0]).not.toHaveProperty("id");
      expect(res.body[0]).not.toHaveProperty("isActive");

      await prisma.homepageSection.deleteMany({ where: { id: { in: [live.body.id, inactive.body.id, scheduled.body.id, expired.body.id] } } });
    });
  });
});
