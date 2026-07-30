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

// Real Postgres, real HTTP, real RBAC — mirrors creator-applications.e2e-spec.ts's structure.
// Builds its own Product -> Offer(ACTIVE) -> LandingPage(PUBLISHED) -> Campaign chain, one
// APPROVED CampaignApplication per creator (Content requires an approved application to exist),
// and drives the full DRAFT -> SUBMITTED -> UNDER_REVIEW -> CHANGES_REQUESTED -> SUBMITTED ->
// UNDER_REVIEW -> APPROVED / REJECTED / EXPIRED lifecycle over real HTTP.
describe("Content (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `content-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let readOnlyStaffToken: string;
  let noPermsStaffToken: string;

  let offerId: string;
  let campaignId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `content-creator-${label}-${suffix}@sofsavdo.com`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Content Creator ${label}`,
            contentNiches: [],
            referralCode: `cnt-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
            socialAccounts: { create: { platform: "INSTAGRAM", handle: `@content_${label}_${suffix}`, profileUrl: "https://instagram.com/x", followerCount: 5000 } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  // Approves the creator directly into the campaign — simulates the outcome of the
  // already-covered Campaign Application approval flow (see creator-applications.e2e-spec.ts),
  // not a workaround for an app bug: Content creation requires a real APPROVED CampaignApplication
  // row to exist, exactly as ContentService.create() checks.
  async function approveIntoCampaign(creatorId: string, forCampaignId: string) {
    return prisma.campaignApplication.create({
      data: { campaignId: forCampaignId, creatorId, status: "APPROVED", approvedAt: new Date(), submittedAt: new Date() },
    });
  }

  async function makeCampaign(slugSuffix: string, over: Record<string, unknown> = {}) {
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Content-test campaign ${slugSuffix}`,
        slug: `content-test-campaign-${slugSuffix}-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        status: "ACTIVE",
        ...over,
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

    const adminRole = await prisma.role.create({ data: { key: `content-admin-${suffix}`, name: "Content Admin" } });
    const adminPerms = await prisma.permission.findMany({
      where: { key: { in: ["content.read", "content.review", "content.approve", "content.reject", "content.revise"] } },
    });
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `content-admin-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const readOnlyRole = await prisma.role.create({ data: { key: `content-readonly-${suffix}`, name: "Content Read-only" } });
    const readPerm = await prisma.permission.findFirst({ where: { key: "content.read" } });
    await prisma.rolePermission.create({ data: { roleId: readOnlyRole.id, permissionId: readPerm!.id } });
    const readOnlyUser = await prisma.user.create({ data: { email: `content-readonly-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } });
    readOnlyStaffToken = tokens.signAccessToken(readOnlyUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `content-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `content-noperm-${suffix}@sofsavdo.com`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);

    const product = await prisma.product.create({ data: { name: `Content-test product ${suffix}`, slug: `content-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Content-test offer ${suffix}`, slug: `content-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" },
    });
    offerId = offer.id;
    await prisma.landingPage.create({ data: { offerId: offer.id, status: "PUBLISHED", publishedAt: new Date() } });
    campaignId = await makeCampaign("main");
  });

  afterAll(async () => {
    // AuditLog has no real FK to Content (generic entityType/entityId, no relation) — capture the
    // ids before the cascading deletes below remove the rows those audit entries reference.
    const contentIds = (await prisma.content.findMany({ where: { campaign: { slug: { contains: suffix } } }, select: { id: true } })).map((c) => c.id);
    if (contentIds.length > 0) await prisma.auditLog.deleteMany({ where: { entityType: "Content", entityId: { in: contentIds } } });

    await prisma.contentReviewComment.deleteMany({ where: { content: { campaign: { slug: { contains: suffix } } } } });
    await prisma.contentVersion.deleteMany({ where: { content: { campaign: { slug: { contains: suffix } } } } });
    await prisma.contentAttachment.deleteMany({ where: { content: { campaign: { slug: { contains: suffix } } } } });
    await prisma.content.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.campaignApplication.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.landingPage.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.socialAccount.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("auth & RBAC guardrails", () => {
    it("rejects unauthenticated requests on both creator and admin routes", async () => {
      await request(app.getHttpServer()).get("/creator/contents").expect(401);
      await request(app.getHttpServer()).get("/admin/contents").expect(401);
    });

    it("a staff user without any content.* permission is forbidden from the admin list", async () => {
      await request(app.getHttpServer()).get("/admin/contents").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("read-only staff can list but cannot approve", async () => {
      await request(app.getHttpServer()).get("/admin/contents").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(200);
      await request(app.getHttpServer()).post("/admin/contents/nonexistent/approve").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(403);
    });
  });

  describe("create — eligibility gate", () => {
    it("rejects creating Content when the creator has no approved CampaignApplication for the campaign", async () => {
      const creator = await makeCreator("no-application");
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/contents`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ caption: "hello" })
        .expect(409);
      expect(res.body.code).toBe("CONTENT_NOT_ELIGIBLE");
    });

    it("rejects creating Content on a campaign whose contentDeadline has already passed", async () => {
      const creator = await makeCreator("past-deadline");
      const expiredCampaignId = await makeCampaign("past-deadline", { contentDeadline: new Date("2000-01-01") });
      await approveIntoCampaign(creator.creatorId, expiredCampaignId);
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${expiredCampaignId}/contents`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ caption: "too late" })
        .expect(409);
      expect(res.body.code).toBe("CONTENT_DEADLINE_PASSED");
    });

    it("creates a DRAFT Content when the CampaignApplication is APPROVED and the deadline hasn't passed", async () => {
      const creator = await makeCreator("happy-path");
      await approveIntoCampaign(creator.creatorId, campaignId);
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/contents`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ caption: "Check out this product!", hashtags: ["#ad", "#beauty"] })
        .expect(201);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.caption).toBe("Check out this product!");
    });
  });

  describe("the full lifecycle: draft -> submit -> review -> changes requested -> resubmit -> approve", () => {
    it("runs the complete flow end-to-end with version history and review comments", async () => {
      // ~16 sequential real HTTP round trips (incl. 2 real multipart uploads) against the
      // remote-proxied test Postgres — comfortably exceeds the shared 60s default (see
      // jest-e2e.config.js's testTimeout comment) without being a hang.
      const creator = await makeCreator("lifecycle");
      await approveIntoCampaign(creator.creatorId, campaignId);
      const auth = `Bearer ${creator.accessToken}`;

      // 1. Create draft
      const created = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/contents`)
        .set("Authorization", auth)
        .send({ caption: "v1 caption", notes: "internal note" })
        .expect(201);
      const contentId = created.body.id;

      // 2. Edit while DRAFT — postUrl included here (Phase P — assertSubmittable now requires it
      // alongside the attachment, see that method's own comment) rather than as a separate PATCH,
      // since it's a durable Content field that stays set through the rest of this lifecycle
      // (submit, resubmit) once written once.
      await request(app.getHttpServer())
        .patch(`/creator/contents/${contentId}`)
        .set("Authorization", auth)
        .send({ caption: "v1 caption edited", postUrl: "https://instagram.com/p/test-lifecycle-post" })
        .expect(200);

      // 3. Submitting with zero attachments is rejected
      const noAttachment = await request(app.getHttpServer()).post(`/creator/contents/${contentId}/submit`).set("Authorization", auth).expect(400);
      expect(noAttachment.body.code).toBe("ATTACHMENT_REQUIRED");

      // 4. Upload a real attachment (magic-byte-sniffed PNG, not a mocked buffer)
      const upload = await request(app.getHttpServer())
        .post(`/creator/contents/${contentId}/attachments`)
        .set("Authorization", auth)
        .field("role", "ATTACHMENT")
        .attach("file", buildTestPng(600, 400), "attachment.png")
        .expect(201);
      expect(upload.body.attachments).toHaveLength(1);
      // Creator-safe: never leaks storage internals.
      expect(JSON.stringify(upload.body)).not.toMatch(/storageKey|mimeType|fileSizeBytes|originalFilename/);

      // 5. Submit -> version 1
      const submitted = await request(app.getHttpServer()).post(`/creator/contents/${contentId}/submit`).set("Authorization", auth).expect(201);
      expect(submitted.body.status).toBe("SUBMITTED");
      expect(submitted.body.currentVersionNumber).toBe(1);
      expect(submitted.body.versions).toHaveLength(1);
      expect(submitted.body.versions[0].versionNumber).toBe(1);
      expect(submitted.body.versions[0].caption).toBe("v1 caption edited");

      // 6. Editing is now locked
      await request(app.getHttpServer()).patch(`/creator/contents/${contentId}`).set("Authorization", auth).send({ caption: "nope" }).expect(409);

      // 7. Admin starts review
      await request(app.getHttpServer()).post(`/admin/contents/${contentId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      // 8. Admin requests changes (mandatory comment)
      const tooShort = await request(app.getHttpServer())
        .post(`/admin/contents/${contentId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "no" })
        .expect(400);
      expect(tooShort.body.code).toBe("VALIDATION_ERROR");

      const changesRequested = await request(app.getHttpServer())
        .post(`/admin/contents/${contentId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Please add the product name in the caption." })
        .expect(201);
      expect(changesRequested.body.status).toBe("CHANGES_REQUESTED");

      // 9. Creator sees the requested changes + review comment
      const afterChanges = await request(app.getHttpServer()).get(`/creator/contents/${contentId}`).set("Authorization", auth).expect(200);
      expect(afterChanges.body.changesRequestedReason).toBe("Please add the product name in the caption.");
      expect(afterChanges.body.comments).toHaveLength(1);
      expect(afterChanges.body.comments[0]).toMatchObject({ action: "CHANGES_REQUESTED", comment: "Please add the product name in the caption." });
      // Creator-safe comment never exposes the reviewing admin's identity.
      expect(afterChanges.body.comments[0]).not.toHaveProperty("authorId");

      // 10. Creator edits again (unlocked by CHANGES_REQUESTED) and resubmits -> version 2
      await request(app.getHttpServer()).patch(`/creator/contents/${contentId}`).set("Authorization", auth).send({ caption: "v2 caption with product name" }).expect(200);
      const resubmitted = await request(app.getHttpServer()).post(`/creator/contents/${contentId}/resubmit`).set("Authorization", auth).expect(201);
      expect(resubmitted.body.status).toBe("SUBMITTED");
      expect(resubmitted.body.currentVersionNumber).toBe(2);
      expect(resubmitted.body.versions).toHaveLength(2);
      // The first version is never lost or overwritten — permanent, append-only history.
      expect(resubmitted.body.versions[0].caption).toBe("v1 caption edited");
      expect(resubmitted.body.versions[1].caption).toBe("v2 caption with product name");

      // 11. Admin reviews and approves
      await request(app.getHttpServer()).post(`/admin/contents/${contentId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      const approved = await request(app.getHttpServer())
        .post(`/admin/contents/${contentId}/approve`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ comment: "Looks great!" })
        .expect(201);
      expect(approved.body.status).toBe("APPROVED");

      // 12. Approved content is immutable — no further editing.
      await request(app.getHttpServer()).patch(`/creator/contents/${contentId}`).set("Authorization", auth).send({ caption: "too late" }).expect(409);

      // 13. Full review-comment history survived across both review rounds.
      const finalAdminView = await request(app.getHttpServer()).get(`/admin/contents/${contentId}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(finalAdminView.body.comments).toHaveLength(2);
      expect(finalAdminView.body.comments.map((c: { action: string }) => c.action)).toEqual(["CHANGES_REQUESTED", "APPROVED"]);
      expect(finalAdminView.body.comments[1]).toHaveProperty("authorId");
    }, 120_000);
  });

  describe("reject — terminal, no resubmission", () => {
    it("rejects with a mandatory reason and blocks any further resubmission", async () => {
      const creator = await makeCreator("reject-flow");
      await approveIntoCampaign(creator.creatorId, campaignId);
      const auth = `Bearer ${creator.accessToken}`;

      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/contents`).set("Authorization", auth).send({ caption: "will be rejected" }).expect(201);
      const contentId = created.body.id;
      await request(app.getHttpServer()).post(`/creator/contents/${contentId}/attachments`).set("Authorization", auth).field("role", "ATTACHMENT").attach("file", buildTestPng(600, 400), "a.png").expect(201);
      // Phase P — submit requires postUrl too (see the lifecycle test's own comment).
      await request(app.getHttpServer()).patch(`/creator/contents/${contentId}`).set("Authorization", auth).send({ postUrl: "https://instagram.com/p/test-reject-flow" }).expect(200);
      await request(app.getHttpServer()).post(`/creator/contents/${contentId}/submit`).set("Authorization", auth).expect(201);
      await request(app.getHttpServer()).post(`/admin/contents/${contentId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      const rejected = await request(app.getHttpServer())
        .post(`/admin/contents/${contentId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Does not follow the campaign brief at all." })
        .expect(201);
      expect(rejected.body.status).toBe("REJECTED");
      expect(rejected.body.rejectionReason).toBe("Does not follow the campaign brief at all.");

      // Terminal — cannot resubmit; the creator must create a brand-new Content.
      const resubmitAttempt = await request(app.getHttpServer()).post(`/creator/contents/${contentId}/resubmit`).set("Authorization", auth).expect(409);
      expect(resubmitAttempt.body.code).toBe("INVALID_CONTENT_TRANSITION");
      await request(app.getHttpServer()).patch(`/creator/contents/${contentId}`).set("Authorization", auth).send({ caption: "nope" }).expect(409);
    });
  });

  describe("deadline enforcement — lazy expiration", () => {
    it("a DRAFT past its campaign's contentDeadline is lazily flipped to EXPIRED on next read", async () => {
      const creator = await makeCreator("expiry");
      const expiringCampaignId = await makeCampaign("expiring", { contentDeadline: new Date(Date.now() + 60_000) });
      await approveIntoCampaign(creator.creatorId, expiringCampaignId);
      const auth = `Bearer ${creator.accessToken}`;

      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${expiringCampaignId}/contents`).set("Authorization", auth).send({ caption: "about to expire" }).expect(201);
      const contentId = created.body.id;

      // Move the deadline into the past directly (simulating time passing).
      await prisma.campaign.update({ where: { id: expiringCampaignId }, data: { contentDeadline: new Date("2000-01-01") } });

      const afterExpiry = await request(app.getHttpServer()).get(`/creator/contents/${contentId}`).set("Authorization", auth).expect(200);
      expect(afterExpiry.body.status).toBe("EXPIRED");

      // Submitting an expired DRAFT correctly fails as an invalid transition, not a deadline check
      // (the row is no longer DRAFT by the time submit() runs its own transition guard).
      await request(app.getHttpServer()).post(`/creator/contents/${contentId}/submit`).set("Authorization", auth).expect(409);
    });
  });

  describe("attachments — validation", () => {
    let contentId: string;
    let auth: string;

    beforeAll(async () => {
      const creator = await makeCreator("attachments");
      await approveIntoCampaign(creator.creatorId, campaignId);
      auth = `Bearer ${creator.accessToken}`;
      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/contents`).set("Authorization", auth).send({ caption: "attachments test" }).expect(201);
      contentId = created.body.id;
    });

    it("rejects a renamed executable — real byte-signature sniffing, not trusting the declared MIME", async () => {
      const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const res = await request(app.getHttpServer())
        .post(`/creator/contents/${contentId}/attachments`)
        .set("Authorization", auth)
        .field("role", "ATTACHMENT")
        .attach("file", fakeExe, "totally-a-photo.jpg")
        .expect(400);
      expect(res.body.code).toBe("INVALID_MEDIA_TYPE");
    });

    it("accepts a THUMBNAIL only at the standard 1080x1440 portrait frame", async () => {
      const wrongSize = await request(app.getHttpServer())
        .post(`/creator/contents/${contentId}/attachments`)
        .set("Authorization", auth)
        .field("role", "THUMBNAIL")
        .attach("file", buildTestPng(500, 500), "thumb.png")
        .expect(400);
      expect(wrongSize.body.code).toBe("INVALID_MEDIA_DIMENSIONS");

      await request(app.getHttpServer())
        .post(`/creator/contents/${contentId}/attachments`)
        .set("Authorization", auth)
        .field("role", "THUMBNAIL")
        .attach("file", buildTestPng(1080, 1440), "thumb-ok.png")
        .expect(201);
    });

    it("rejects a second THUMBNAIL — at most one per Content", async () => {
      const res = await request(app.getHttpServer())
        .post(`/creator/contents/${contentId}/attachments`)
        .set("Authorization", auth)
        .field("role", "THUMBNAIL")
        .attach("file", buildTestPng(1080, 1440), "thumb2.png")
        .expect(409);
      expect(res.body.code).toBe("THUMBNAIL_ALREADY_EXISTS");
    });

    it("removes an attachment while still editable", async () => {
      const withAttachments = await request(app.getHttpServer()).get(`/creator/contents/${contentId}`).set("Authorization", auth).expect(200);
      const thumbnail = withAttachments.body.attachments.find((a: { role: string }) => a.role === "THUMBNAIL");
      await request(app.getHttpServer()).delete(`/creator/content-attachments/${thumbnail.id}`).set("Authorization", auth).expect(200);
      const after = await request(app.getHttpServer()).get(`/creator/contents/${contentId}`).set("Authorization", auth).expect(200);
      expect(after.body.attachments.find((a: { role: string }) => a.role === "THUMBNAIL")).toBeUndefined();
    });
  });

  describe("ownership & id-guessing", () => {
    it("a different creator cannot read or edit this Content (404, not FORBIDDEN)", async () => {
      const owner = await makeCreator("owner");
      await approveIntoCampaign(owner.creatorId, campaignId);
      const stranger = await makeCreator("stranger");

      const created = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/contents`)
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .send({ caption: "mine" })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/creator/contents/${created.body.id}`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .expect(404);
      const res = await request(app.getHttpServer())
        .patch(`/creator/contents/${created.body.id}`)
        .set("Authorization", `Bearer ${stranger.accessToken}`)
        .send({ caption: "hijacked" })
        .expect(404);
      expect(res.body.code).toBe("CONTENT_NOT_FOUND");
    });
  });

  describe("creator dashboard counts (backend-computed)", () => {
    it("reflects real counts per status", async () => {
      const creator = await makeCreator("dashboard");
      await approveIntoCampaign(creator.creatorId, campaignId);
      const auth = `Bearer ${creator.accessToken}`;
      await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/contents`).set("Authorization", auth).send({ caption: "draft one" }).expect(201);
      await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/contents`).set("Authorization", auth).send({ caption: "draft two" }).expect(201);

      const counts = await request(app.getHttpServer()).get("/creator/contents/dashboard-counts").set("Authorization", auth).expect(200);
      expect(counts.body.DRAFT).toBe(2);
      expect(counts.body.APPROVED).toBe(0);
    });
  });

  describe("admin — list filters", () => {
    it("filters by campaignId/status and supports search/pagination", async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/contents?campaignId=${campaignId}&page=1&pageSize=5`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body.items.every((c: { campaignId: string }) => c.campaignId === campaignId)).toBe(true);
    });
  });

  describe("permission revocation takes effect immediately", () => {
    it("revoking content.approve mid-session 403s the very next request with the same JWT", async () => {
      const tempRole = await prisma.role.create({ data: { key: `content-temp-${suffix}`, name: "Temp Content Admin" } });
      const perms = await prisma.permission.findMany({ where: { key: { in: ["content.read", "content.review", "content.approve"] } } });
      await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: tempRole.id, permissionId: p.id })) });
      const tempUser = await prisma.user.create({ data: { email: `content-temp-${suffix}@sofsavdo.com`, passwordHash: "x" } });
      await prisma.userRole.create({ data: { userId: tempUser.id, roleId: tempRole.id } });
      const tempToken = tokens.signAccessToken(tempUser.id);

      await request(app.getHttpServer()).get("/admin/contents").set("Authorization", `Bearer ${tempToken}`).expect(200);

      const approvePerm = perms.find((p) => p.key === "content.approve")!;
      await prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId: tempRole.id, permissionId: approvePerm.id } } });

      await request(app.getHttpServer()).post("/admin/contents/nonexistent/approve").set("Authorization", `Bearer ${tempToken}`).expect(403);
    });
  });
});
