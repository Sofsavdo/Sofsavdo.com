import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — creates its own ADMIN-roled user (rather than depending
// on prisma/seed.ts having run) so this suite is self-contained and order-independent.
describe("Products (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `products-e2e-${Date.now()}`;
  let adminAccessToken: string;
  let creatorAccessToken: string;

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
    const perms = await prisma.permission.findMany({
      where: { key: { in: ["product.read", "product.write", "product.archive"] } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const creatorUser = await prisma.user.create({
      data: {
        email: `creator-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: { create: { displayName: "Test Creator", contentNiches: [], referralCode: suffix } },
      },
    });
    creatorAccessToken = tokens.signAccessToken(creatorUser.id);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/admin/products").expect(401);
  });

  it("rejects a creator (no product.* permissions) with a typed FORBIDDEN", async () => {
    const res = await request(app.getHttpServer())
      .get("/admin/products")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("rejects an invalid slug with VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Bad Slug Product", slug: "Not A Valid Slug!", type: "PHYSICAL_PRODUCT" })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("creates a product with an authorized admin token", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        name: "E2E Serum",
        slug: `e2e-serum-${suffix}`,
        type: "PHYSICAL_PRODUCT",
        costPriceMinor: 5_000_00,
      })
      .expect(201);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.currency).toBe("UZS");
    expect(res.body.images).toEqual([]);
  });

  it("rejects a duplicate slug with SLUG_TAKEN", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Duplicate", slug: `e2e-serum-${suffix}`, type: "PHYSICAL_PRODUCT" })
      .expect(409);
    expect(res.body.code).toBe("SLUG_TAKEN");
  });

  it("lists products filtered by search, matching the just-created product", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/products?search=${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe(`e2e-serum-${suffix}`);
    expect(res.body.total).toBe(1);
  });

  it("updates a product", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/products?search=${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/admin/products/${id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "E2E Serum (updated)" })
      .expect(200);
    expect(res.body.name).toBe("E2E Serum (updated)");
  });

  it("archives a product, then blocks further content edits until unarchived", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/products?search=${suffix}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    const id = list.body.items[0].id;

    const archived = await request(app.getHttpServer())
      .post(`/admin/products/${id}/archive`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(201);
    expect(archived.body.status).toBe("ARCHIVED");

    const blocked = await request(app.getHttpServer())
      .patch(`/admin/products/${id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: "Should be blocked" })
      .expect(409);
    expect(blocked.body.code).toBe("PRODUCT_ARCHIVED");

    const unarchived = await request(app.getHttpServer())
      .patch(`/admin/products/${id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "DRAFT" })
      .expect(200);
    expect(unarchived.body.status).toBe("DRAFT");
  });

  it("404s with a typed NOT_FOUND for a nonexistent product", async () => {
    const res = await request(app.getHttpServer())
      .get("/admin/products/does-not-exist")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});
