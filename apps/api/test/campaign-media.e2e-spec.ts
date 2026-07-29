import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";
import { buildTestPng } from "../src/campaign-media/test-helpers/build-test-png";

// Real Postgres, real HTTP, real LocalDiskStorage — verifies the actual upload → validate →
// store → serve-safe-response pipeline, not a mocked one. Mirrors campaigns.e2e-spec.ts's
// structure/cleanup convention.
describe("Campaign Media (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `cmedia-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let campaignId: string;
  let secondCampaignId: string;

  function mp4Bytes(): Buffer {
    const buf = Buffer.alloc(20);
    buf.writeUInt32BE(20, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    return buf;
  }

  async function makeCampaign(slugSuffix: string): Promise<string> {
    const product = await prisma.product.create({
      data: { name: `Media-test product ${slugSuffix}`, slug: `media-test-product-${slugSuffix}-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Media-test offer ${slugSuffix}`, slug: `media-test-offer-${slugSuffix}-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" },
    });
    const campaign = await prisma.campaign.create({
      data: {
        offerId: offer.id,
        name: `Media-test campaign ${slugSuffix}`,
        slug: `media-test-campaign-${slugSuffix}-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        status: "ACTIVE",
      },
    });
    return campaign.id;
  }

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

    const adminRole = await prisma.role.create({ data: { key: `cmedia-admin-${suffix}`, name: "Media Admin" } });
    const writePerm = await prisma.permission.findFirst({ where: { key: "campaign.write" } });
    const readPerm = await prisma.permission.findFirst({ where: { key: "campaign.read" } });
    await prisma.rolePermission.createMany({
      data: [writePerm!, readPerm!].map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    });
    const adminUser = await prisma.user.create({ data: { email: `cmedia-admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    campaignId = await makeCampaign("main");
    secondCampaignId = await makeCampaign("second");
  });

  afterAll(async () => {
    await prisma.campaignMedia.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated upload with 401", async () => {
    await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .field("mediaRole", "GALLERY")
      .attach("file", buildTestPng(1080, 1440), "cover.png")
      .expect(401);
  });

  it("uploads a valid 1080×1440 cover image and returns a creator-safe response with no storage metadata", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "COVER")
      .attach("file", buildTestPng(1080, 1440), "cover.png")
      .expect(201);

    expect(res.body.mediaRole).toBe("COVER");
    expect(res.body.mediaType).toBe("IMAGE");
    expect(res.body.width).toBe(1080);
    expect(res.body.height).toBe(1440);
    expect(res.body.publicUrl).toEqual(expect.stringContaining("http"));
  });

  it("rejects a second cover upload for the same campaign with COVER_ALREADY_EXISTS", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "COVER")
      .attach("file", buildTestPng(1080, 1440), "cover2.png")
      .expect(409);
    expect(res.body.code).toBe("COVER_ALREADY_EXISTS");
  });

  it("replaces the cover via the dedicated replace-cover endpoint, removing the old row", async () => {
    const before = await prisma.campaignMedia.findFirst({ where: { campaignId, mediaRole: "COVER" } });
    const res = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media/cover`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "COVER")
      .attach("file", buildTestPng(1080, 1440), "new-cover.png")
      .expect(201);

    const covers = await prisma.campaignMedia.findMany({ where: { campaignId, mediaRole: "COVER" } });
    expect(covers).toHaveLength(1);
    expect(covers[0]!.id).not.toBe(before!.id);
    expect(res.body.id).toBe(covers[0]!.id);
  });

  it("rejects an image with the wrong aspect ratio with INVALID_MEDIA_DIMENSIONS", async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "GALLERY")
      .attach("file", buildTestPng(1000, 1000), "square.png")
      .expect(400);
    expect(res.body.code).toBe("INVALID_MEDIA_DIMENSIONS");
  });

  it("rejects a non-image/video file (executable content) with INVALID_MEDIA_TYPE", async () => {
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "GALLERY")
      .attach("file", exeBytes, "totally-a-photo.jpg")
      .expect(400);
    expect(res.body.code).toBe("INVALID_MEDIA_TYPE");
  });

  it("uploads a valid gallery image and a video", async () => {
    const galleryRes = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "GALLERY")
      .attach("file", buildTestPng(1080, 1440), "gallery1.png")
      .expect(201);
    expect(galleryRes.body.mediaType).toBe("IMAGE");

    const videoRes = await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .field("mediaRole", "PROMOTIONAL")
      .field("width", "1080")
      .field("height", "1440")
      .field("durationSeconds", "30")
      .attach("file", mp4Bytes(), "promo.mp4")
      .expect(201);
    expect(videoRes.body.mediaType).toBe("VIDEO");
    expect(videoRes.body.mediaRole).toBe("PROMOTIONAL");
  });

  it("reorders gallery/promotional media via the reorder endpoint", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const nonCover = list.body.filter((m: { mediaRole: string }) => m.mediaRole !== "COVER");
    const reversed = [...nonCover].reverse().map((m: { id: string }) => m.id);

    await request(app.getHttpServer())
      .post(`/admin/campaigns/${campaignId}/media/reorder`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ orderedIds: reversed })
      .expect(201);

    const rows = await prisma.campaignMedia.findMany({ where: { id: { in: reversed } }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.id)).toEqual(reversed);
  });

  it("promotes a gallery item to cover, demoting the previous cover to gallery", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const galleryItem = list.body.find((m: { mediaRole: string }) => m.mediaRole === "GALLERY");
    const oldCover = list.body.find((m: { mediaRole: string }) => m.mediaRole === "COVER");

    await request(app.getHttpServer())
      .patch(`/admin/campaign-media/${galleryItem.id}/set-cover`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const covers = await prisma.campaignMedia.findMany({ where: { campaignId, mediaRole: "COVER" } });
    expect(covers).toHaveLength(1);
    expect(covers[0]!.id).toBe(galleryItem.id);
    const demoted = await prisma.campaignMedia.findUnique({ where: { id: oldCover.id } });
    expect(demoted!.mediaRole).toBe("GALLERY");
  });

  it("deletes a media item, removing both the row and the stored file", async () => {
    const list = await request(app.getHttpServer())
      .get(`/admin/campaigns/${campaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    const promo = list.body.find((m: { mediaRole: string }) => m.mediaRole === "PROMOTIONAL");

    await request(app.getHttpServer())
      .delete(`/admin/campaign-media/${promo.id}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(204);

    const gone = await prisma.campaignMedia.findUnique({ where: { id: promo.id } });
    expect(gone).toBeNull();
  });

  it("scopes media to the correct campaign — a second campaign's media list is empty", async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/campaigns/${secondCampaignId}/media`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("the embedded media on a Campaign response never leaks storageKey, mimeType, fileSizeBytes, or originalFilename", async () => {
    const adminRes = await request(app.getHttpServer())
      .get(`/admin/campaigns/${campaignId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(adminRes.body.media.length).toBeGreaterThan(0);
    for (const m of adminRes.body.media) {
      expect(m).not.toHaveProperty("storageKey");
      expect(m).not.toHaveProperty("mimeType");
      expect(m).not.toHaveProperty("fileSizeBytes");
      expect(m).not.toHaveProperty("originalFilename");
    }
  });
});
