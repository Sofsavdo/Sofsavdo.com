import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — self-contained, mirrors landings.e2e-spec.ts's structure.
// Builds its own Product -> Offer(ACTIVE) -> LandingPage(PUBLISHED) chain to link campaigns to.
describe("Campaigns (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `campaigns-e2e-${Date.now()}`;
  let adminAccessToken: string;
  let creatorAccessToken: string;
  let staffNoPermsToken: string;
  let offerId: string;
  let archivedOfferId: string;
  let inactiveOfferId: string;
  let offerWithoutLandingId: string;
  let campaignId: string;

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
      where: { key: { in: ["campaign.read", "campaign.write", "campaign.publish", "campaign.pause", "campaign.complete", "campaign.archive"] } },
    });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: role.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const readOnlyRole = await prisma.role.create({ data: { key: `readonly-${suffix}`, name: "Read only" } });
    const readPerm = await prisma.permission.findFirst({ where: { key: "campaign.read" } });
    if (readPerm) await prisma.rolePermission.create({ data: { roleId: readOnlyRole.id, permissionId: readPerm.id } });
    const staffNoPermsUser = await prisma.user.create({ data: { email: `staffnp-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: staffNoPermsUser.id, roleId: readOnlyRole.id } });
    staffNoPermsToken = tokens.signAccessToken(staffNoPermsUser.id);

    const creatorUser = await prisma.user.create({
      data: {
        email: `creator-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: "Test Creator",
            contentNiches: [],
            referralCode: suffix,
            // RequireCreatorGuard requires an APPROVED onboarding CreatorApplication (see
            // DECISIONS.md ADR-012) — without this row, every creator-route assertion below would
            // 403 with CREATOR_NOT_APPROVED instead of exercising the actual Campaign behavior.
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
    });
    creatorAccessToken = tokens.signAccessToken(creatorUser.id);

    const product = await prisma.product.create({
      data: { name: `Campaign-test product ${suffix}`, slug: `campaign-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });

    async function makeOffer(slugSuffix: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED", withPublishedLanding: boolean) {
      const offer = await prisma.offer.create({
        data: {
          productId: product.id,
          name: `Campaign-test offer ${slugSuffix} ${suffix}`,
          slug: `campaign-test-offer-${slugSuffix}-${suffix}`,
          headline: "Test headline",
          priceMinor: 100_000,
          status,
        },
      });
      if (withPublishedLanding) {
        await prisma.landingPage.create({ data: { offerId: offer.id, status: "PUBLISHED", publishedAt: new Date() } });
      }
      return offer;
    }

    const activeOffer = await makeOffer("active", "ACTIVE", true);
    offerId = activeOffer.id;
    const archivedOffer = await makeOffer("archived", "ARCHIVED", true);
    archivedOfferId = archivedOffer.id;
    const inactiveOffer = await makeOffer("inactive", "DRAFT", true);
    inactiveOfferId = inactiveOffer.id;
    const noLandingOffer = await makeOffer("nolanding", "ACTIVE", false);
    offerWithoutLandingId = noLandingOffer.id;
  });

  afterAll(async () => {
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.landingPage.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get("/admin/campaigns").expect(401);
  });

  it("rejects a staff user without campaign.write with a typed FORBIDDEN", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${staffNoPermsToken}`)
      .send({ offerId, name: "x", slug: `x-${suffix}`, category: "beauty", ctaLabel: "Join", commissionType: "PERCENTAGE", commissionRateBps: 1000 })
      .expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("a creator cannot call admin campaign endpoints", async () => {
    await request(app.getHttpServer()).get("/admin/campaigns").set("Authorization", `Bearer ${creatorAccessToken}`).expect(403);
  });

  it("rejects creation against a nonexistent offer with NOT_FOUND", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ offerId: "does-not-exist", name: "No offer", slug: `x2-${suffix}`, category: "beauty", ctaLabel: "Join", commissionType: "PERCENTAGE", commissionRateBps: 1000 })
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("creates a DRAFT campaign linked to a real Offer", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        offerId,
        name: "E2E campaign",
        slug: `e2e-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
      })
      .expect(201);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.commissionSource).toBe("CAMPAIGN");
    expect(res.body.availability).toBe("INACTIVE");
    expect(res.body.offer.id).toBe(offerId);
    expect(res.body.product.id).toBeDefined();
    campaignId = res.body.id;
  });

  it("rejects a duplicate slug with SLUG_TAKEN", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ offerId, name: "dup", slug: `e2e-campaign-${suffix}`, category: "beauty", ctaLabel: "Join", commissionType: "PERCENTAGE", commissionRateBps: 1000 })
      .expect(409);
    expect(res.body.code).toBe("SLUG_TAKEN");
  });

  it("lists campaigns, searchable by campaign name, slug, offer name, and product name", async () => {
    const bySlug = await request(app.getHttpServer()).get(`/admin/campaigns?search=e2e-campaign-${suffix}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
    expect(bySlug.body.items).toHaveLength(1);

    const byName = await request(app.getHttpServer()).get(`/admin/campaigns?search=E2E campaign`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
    expect(byName.body.items.some((c: { id: string }) => c.id === campaignId)).toBe(true);

    const byProductName = await request(app.getHttpServer())
      .get(`/admin/campaigns?search=${encodeURIComponent(`Campaign-test product ${suffix}`)}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(byProductName.body.items.some((c: { id: string }) => c.id === campaignId)).toBe(true);
  });

  it("filters by offerId and paginates", async () => {
    const res = await request(app.getHttpServer()).get(`/admin/campaigns?offerId=${offerId}&page=1&pageSize=5`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
    expect(res.body.items.every((c: { offerId: string }) => c.offerId === offerId)).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(5);
  });

  it("404s with a typed NOT_FOUND for a nonexistent campaign", async () => {
    const res = await request(app.getHttpServer()).get("/admin/campaigns/does-not-exist").set("Authorization", `Bearer ${adminAccessToken}`).expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("gets campaign detail", async () => {
    const res = await request(app.getHttpServer()).get(`/admin/campaigns/${campaignId}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
    expect(res.body.slug).toBe(`e2e-campaign-${suffix}`);
    expect(res.body.landingAvailability).toBe("PUBLISHED");
  });

  it("updates a campaign's content", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/campaigns/${campaignId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ description: "Updated description" })
      .expect(200);
    expect(res.body.description).toBe("Updated description");
  });

  it("blocks activation of a campaign linked to an archived Offer with CAMPAIGN_NOT_ELIGIBLE", async () => {
    const created = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        offerId: archivedOfferId,
        name: "Archived offer campaign",
        slug: `archived-offer-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 1000,
      })
      .expect(201);
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${created.body.id}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(res.body.code).toBe("CAMPAIGN_NOT_ELIGIBLE");
    expect(res.body.details.reason).toBe("OFFER_ARCHIVED");
  });

  it("blocks activation of a campaign linked to an inactive (DRAFT) Offer", async () => {
    const created = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        offerId: inactiveOfferId,
        name: "Inactive offer campaign",
        slug: `inactive-offer-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 1000,
      })
      .expect(201);
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${created.body.id}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(res.body.details.reason).toBe("OFFER_NOT_ACTIVE");
  });

  it("blocks activation of a campaign whose Offer has no Landing", async () => {
    const created = await request(app.getHttpServer())
      .post("/admin/campaigns")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        offerId: offerWithoutLandingId,
        name: "No landing campaign",
        slug: `no-landing-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 1000,
      })
      .expect(201);
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${created.body.id}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(res.body.details.reason).toBe("LANDING_MISSING");
  });

  it("the creator catalog does not show the campaign while it's DRAFT", async () => {
    const res = await request(app.getHttpServer()).get("/creator/campaigns").set("Authorization", `Bearer ${creatorAccessToken}`).expect(200);
    expect(res.body.some((c: { id: string }) => c.id === campaignId)).toBe(false);
  });

  it("a creator cannot open the DRAFT campaign's detail through a guessed id (404, not FORBIDDEN)", async () => {
    const res = await request(app.getHttpServer()).get(`/creator/campaigns/${campaignId}`).set("Authorization", `Bearer ${creatorAccessToken}`).expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("activates the campaign (fully eligible), and availability becomes LIVE", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
    expect(res.body.status).toBe("ACTIVE");
    expect(res.body.availability).toBe("LIVE");
  });

  it("invalid transition ACTIVE -> ACTIVE (re-activating) is rejected", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(res.body.code).toBe("INVALID_CAMPAIGN_TRANSITION");
  });

  it("the creator catalog now shows the ACTIVE campaign, with creator-safe fields only", async () => {
    const res = await request(app.getHttpServer()).get("/creator/campaigns").set("Authorization", `Bearer ${creatorAccessToken}`).expect(200);
    const found = res.body.find((c: { id: string }) => c.id === campaignId);
    expect(found).toBeDefined();
    expect(found.offer.priceMinor).toBe(100_000);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("internalName");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("createdById");
    expect(serialized).not.toContain("updatedById");
    expect(serialized).not.toContain("archivedAt");
  });

  it("a creator can open the ACTIVE campaign's detail", async () => {
    const res = await request(app.getHttpServer()).get(`/creator/campaigns/${campaignId}`).set("Authorization", `Bearer ${creatorAccessToken}`).expect(200);
    expect(res.body.id).toBe(campaignId);
    expect(res.body.availability).toBe("LIVE");
  });

  it("a non-creator (staff) cannot call creator campaign endpoints", async () => {
    const res = await request(app.getHttpServer()).get("/creator/campaigns").set("Authorization", `Bearer ${adminAccessToken}`).expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("valid transition ACTIVE -> PAUSED succeeds, and creator catalog hides it again", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/pause`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
    expect(res.body.status).toBe("PAUSED");

    const catalog = await request(app.getHttpServer()).get("/creator/campaigns").set("Authorization", `Bearer ${creatorAccessToken}`).expect(200);
    expect(catalog.body.some((c: { id: string }) => c.id === campaignId)).toBe(false);
  });

  it("valid transition PAUSED -> ACTIVE (reactivate) succeeds", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
    expect(res.body.status).toBe("ACTIVE");
  });

  it("valid transition ACTIVE -> COMPLETED succeeds", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/complete`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
    expect(res.body.status).toBe("COMPLETED");
  });

  it("invalid transition COMPLETED -> ACTIVE is rejected", async () => {
    const res = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(res.body.code).toBe("INVALID_CAMPAIGN_TRANSITION");
  });

  it("archives the campaign, sets archivedAt, and blocks further edits", async () => {
    const archived = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/archive`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
    expect(archived.body.status).toBe("ARCHIVED");
    expect(archived.body.archivedAt).not.toBeNull();

    const blockedEdit = await request(app.getHttpServer())
      .patch(`/admin/campaigns/${campaignId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ description: "Should be blocked" })
      .expect(409);
    expect(blockedEdit.body.code).toBe("CAMPAIGN_ARCHIVED");

    const blockedReactivate = await request(app.getHttpServer()).post(`/admin/campaigns/${campaignId}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
    expect(blockedReactivate.body.code).toBe("INVALID_CAMPAIGN_TRANSITION");
  });

  it("the creator catalog and detail stay unavailable for the archived campaign", async () => {
    const catalog = await request(app.getHttpServer()).get("/creator/campaigns").set("Authorization", `Bearer ${creatorAccessToken}`).expect(200);
    expect(catalog.body.some((c: { id: string }) => c.id === campaignId)).toBe(false);

    const detail = await request(app.getHttpServer()).get(`/creator/campaigns/${campaignId}`).set("Authorization", `Bearer ${creatorAccessToken}`).expect(404);
    expect(detail.body.code).toBe("NOT_FOUND");
  });
});
