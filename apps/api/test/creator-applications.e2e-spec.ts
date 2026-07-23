import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors campaigns.e2e-spec.ts's structure. Builds its own
// Product -> Offer(ACTIVE) -> LandingPage(PUBLISHED) -> Campaign chain plus several creators, each
// with an APPROVED onboarding CreatorApplication (required by RequireCreatorGuard) and a social
// account (for follower-eligibility checks).
describe("Creator Applications (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `capps-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let readOnlyStaffToken: string;
  let noPermsStaffToken: string;
  let adminRoleId: string;
  let approvePermissionId: string;

  let offerId: string;

  async function makeCreator(label: string, opts: { followerCount?: number; platform?: "INSTAGRAM" | "TIKTOK" } = {}) {
    const user = await prisma.user.create({
      data: {
        email: `creator-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Creator ${label}`,
            contentNiches: [],
            referralCode: `${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
            socialAccounts: {
              create: {
                platform: opts.platform ?? "INSTAGRAM",
                handle: `@creator_${label}_${suffix}`,
                profileUrl: `https://instagram.com/creator_${label}_${suffix}`,
                followerCount: opts.followerCount ?? 5000,
              },
            },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeCampaign(slugSuffix: string, over: Record<string, unknown> = {}) {
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Application-test campaign ${slugSuffix}`,
        slug: `application-test-campaign-${slugSuffix}-${suffix}`,
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

    const adminRole = await prisma.role.create({ data: { key: `capps-admin-${suffix}`, name: "Application Admin" } });
    adminRoleId = adminRole.id;
    const adminPerms = await prisma.permission.findMany({
      where: { key: { in: ["application.read", "application.review", "application.approve", "application.reject", "application.revise"] } },
    });
    approvePermissionId = adminPerms.find((p) => p.key === "application.approve")!.id;
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `capps-admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const readOnlyRole = await prisma.role.create({ data: { key: `capps-readonly-${suffix}`, name: "Application Read-only" } });
    const readPerm = await prisma.permission.findFirst({ where: { key: "application.read" } });
    await prisma.rolePermission.create({ data: { roleId: readOnlyRole.id, permissionId: readPerm!.id } });
    const readOnlyUser = await prisma.user.create({ data: { email: `capps-readonly-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } });
    readOnlyStaffToken = tokens.signAccessToken(readOnlyUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `capps-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `capps-noperm-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);

    const product = await prisma.product.create({
      data: { name: `Application-test product ${suffix}`, slug: `application-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" },
    });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Application-test offer ${suffix}`, slug: `application-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" },
    });
    offerId = offer.id;
    await prisma.landingPage.create({ data: { offerId: offer.id, status: "PUBLISHED", publishedAt: new Date() } });
  });

  afterAll(async () => {
    await prisma.creatorCampaign.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
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
    it("rejects an unauthenticated request on both creator and admin routes", async () => {
      await request(app.getHttpServer()).get("/creator/applications").expect(401);
      await request(app.getHttpServer()).get("/admin/creator-applications").expect(401);
    });

    it("a staff user without any application.* permission is forbidden from the admin list", async () => {
      const res = await request(app.getHttpServer()).get("/admin/creator-applications").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("a read-only staff user can list but not approve", async () => {
      await request(app.getHttpServer()).get("/admin/creator-applications").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(200);
      await request(app.getHttpServer()).post("/admin/creator-applications/nonexistent/approve").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(403);
    });
  });

  describe("eligibility on create", () => {
    let creator: Awaited<ReturnType<typeof makeCreator>>;

    beforeAll(async () => {
      creator = await makeCreator("elig");
    });

    it("404s against a nonexistent campaign", async () => {
      const res = await request(app.getHttpServer())
        .post("/creator/campaigns/does-not-exist/applications")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("blocks applying to a non-LIVE (DRAFT) campaign", async () => {
      const campaignId = await makeCampaign("draft", { status: "DRAFT" });
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(409);
      expect(res.body.code).toBe("APPLICATION_NOT_ELIGIBLE");
      expect(res.body.details.reason).toBe("CAMPAIGN_NOT_LIVE");
    });

    it("blocks applying once the application window has closed", async () => {
      const campaignId = await makeCampaign("closed", { applicationDeadline: new Date("2020-01-01") });
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(409);
      expect(res.body.details.reason).toBe("CLOSED");
    });

    it("blocks a creator below the campaign's minimum follower requirement", async () => {
      const campaignId = await makeCampaign("minfollowers", { minFollowers: 100_000 });
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(409);
      expect(res.body.details.reason).toBe("BELOW_MIN_FOLLOWERS");
    });

    it("blocks a platform mismatch between the application and the campaign", async () => {
      const campaignId = await makeCampaign("platform", { platforms: ["TIKTOK"] });
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ platform: "INSTAGRAM" })
        .expect(409);
      expect(res.body.details.reason).toBe("PLATFORM_MISMATCH");
    });

    it("creates a DRAFT application, creator-safe response only", async () => {
      const campaignId = await makeCampaign("ok");
      const res = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ message: "pick me", platform: "INSTAGRAM" })
        .expect(201);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body).not.toHaveProperty("adminNotes");
      expect(res.body).not.toHaveProperty("reviewedById");
    });

    it("rejects a duplicate application to the same campaign with ALREADY_APPLIED", async () => {
      const campaignId = await makeCampaign("dup");
      await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
      const res = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(409);
      expect(res.body.code).toBe("ALREADY_APPLIED");
    });
  });

  describe("full lifecycle: draft -> submit -> changes requested -> resubmit -> reject", () => {
    let creatorA: Awaited<ReturnType<typeof makeCreator>>;
    let creatorB: Awaited<ReturnType<typeof makeCreator>>;
    let campaignId: string;
    let applicationId: string;

    beforeAll(async () => {
      creatorA = await makeCreator("lifecycle-a");
      creatorB = await makeCreator("lifecycle-b");
      campaignId = await makeCampaign("lifecycle");
    });

    it("creator creates and edits a DRAFT", async () => {
      const created = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({ message: "first draft", platform: "INSTAGRAM" })
        .expect(201);
      applicationId = created.body.id;

      const updated = await request(app.getHttpServer())
        .patch(`/creator/applications/${applicationId}`)
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({ message: "updated pitch", platform: "INSTAGRAM" })
        .expect(200);
      expect(updated.body.message).toBe("updated pitch");
    });

    it("a different creator cannot read or edit this application (404, not FORBIDDEN — no id guessing)", async () => {
      const getRes = await request(app.getHttpServer()).get(`/creator/applications/${applicationId}`).set("Authorization", `Bearer ${creatorB.accessToken}`).expect(404);
      expect(getRes.body.code).toBe("NOT_FOUND");
      await request(app.getHttpServer())
        .patch(`/creator/applications/${applicationId}`)
        .set("Authorization", `Bearer ${creatorB.accessToken}`)
        .send({ message: "hijack" })
        .expect(404);
    });

    it("submits the application (requiresApproval campaign -> SUBMITTED, not auto-approved)", async () => {
      const res = await request(app.getHttpServer()).post(`/creator/applications/${applicationId}/submit`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(201);
      expect(res.body.status).toBe("SUBMITTED");
      expect(res.body.submittedAt).not.toBeNull();
    });

    it("resubmitting a SUBMITTED (not CHANGES_REQUESTED) application is rejected", async () => {
      const res = await request(app.getHttpServer()).post(`/creator/applications/${applicationId}/resubmit`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(409);
      expect(res.body.code).toBe("INVALID_APPLICATION_TRANSITION");
    });

    it("now appears in the creator's own list (DRAFT is excluded, SUBMITTED is not)", async () => {
      const res = await request(app.getHttpServer()).get("/creator/applications").set("Authorization", `Bearer ${creatorA.accessToken}`).expect(200);
      expect(res.body.some((a: { id: string; status: string }) => a.id === applicationId && a.status === "SUBMITTED")).toBe(true);
    });

    it("admin lists it, filterable by status and campaignId, searchable by creator name", async () => {
      const byStatus = await request(app.getHttpServer()).get("/admin/creator-applications?status=SUBMITTED").set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(byStatus.body.items.some((a: { id: string }) => a.id === applicationId)).toBe(true);

      const byCampaign = await request(app.getHttpServer()).get(`/admin/creator-applications?campaignId=${campaignId}`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(byCampaign.body.items.some((a: { id: string }) => a.id === applicationId)).toBe(true);

      const bySearch = await request(app.getHttpServer())
        .get(`/admin/creator-applications?search=${encodeURIComponent("Creator lifecycle-a")}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(bySearch.body.items.some((a: { id: string }) => a.id === applicationId)).toBe(true);
    });

    it("start-review is rejected on a DRAFT-only guessed id, but succeeds on this SUBMITTED one", async () => {
      const res = await request(app.getHttpServer()).post(`/admin/creator-applications/${applicationId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      expect(res.body.status).toBe("UNDER_REVIEW");
    });

    it("request-changes requires a meaningful reason (min length enforced)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/creator-applications/${applicationId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "no" })
        .expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("request-changes succeeds with a valid reason, and the reason is visible to the creator but adminNotes/reviewedById never leak", async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/creator-applications/${applicationId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Please add a portfolio link" })
        .expect(201);
      expect(res.body.status).toBe("CHANGES_REQUESTED");

      const creatorView = await request(app.getHttpServer()).get(`/creator/applications/${applicationId}`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(200);
      expect(creatorView.body.changesRequestedReason).toBe("Please add a portfolio link");
      expect(creatorView.body).not.toHaveProperty("adminNotes");
      expect(creatorView.body).not.toHaveProperty("reviewedById");
    });

    it("creator edits the draft again from CHANGES_REQUESTED and resubmits back to SUBMITTED", async () => {
      await request(app.getHttpServer())
        .patch(`/creator/applications/${applicationId}`)
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({ portfolioLinks: ["https://instagram.com/p/abc"] })
        .expect(200);
      const res = await request(app.getHttpServer()).post(`/creator/applications/${applicationId}/resubmit`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(201);
      expect(res.body.status).toBe("SUBMITTED");
    });

    it("reject requires a meaningful reason and is only valid from UNDER_REVIEW", async () => {
      const wrongState = await request(app.getHttpServer())
        .post(`/admin/creator-applications/${applicationId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Not eligible after all" })
        .expect(409);
      expect(wrongState.body.code).toBe("INVALID_APPLICATION_TRANSITION");

      await request(app.getHttpServer()).post(`/admin/creator-applications/${applicationId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      const badReason = await request(app.getHttpServer())
        .post(`/admin/creator-applications/${applicationId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "x" })
        .expect(400);
      expect(badReason.body.code).toBe("VALIDATION_ERROR");

      const rejected = await request(app.getHttpServer())
        .post(`/admin/creator-applications/${applicationId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Not eligible after all" })
        .expect(201);
      expect(rejected.body.status).toBe("REJECTED");
      expect(rejected.body.rejectionReason).toBe("Not eligible after all");
    });

    it("REJECTED is terminal — withdraw and resubmit are both rejected", async () => {
      await request(app.getHttpServer()).post(`/creator/applications/${applicationId}/withdraw`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(409);
      await request(app.getHttpServer()).post(`/creator/applications/${applicationId}/resubmit`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(409);
    });
  });

  describe("withdrawal", () => {
    it("a SUBMITTED application can be withdrawn, and withdrawal is terminal", async () => {
      const creator = await makeCreator("withdraw");
      const campaignId = await makeCampaign("withdraw");
      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);

      const withdrawn = await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/withdraw`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      expect(withdrawn.body.status).toBe("WITHDRAWN");

      await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/withdraw`).set("Authorization", `Bearer ${creator.accessToken}`).expect(409);
    });

    it("a DRAFT application cannot be withdrawn directly", async () => {
      const creator = await makeCreator("withdraw-draft");
      const campaignId = await makeCampaign("withdraw-draft");
      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
      const res = await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/withdraw`).set("Authorization", `Bearer ${creator.accessToken}`).expect(409);
      expect(res.body.code).toBe("INVALID_APPLICATION_TRANSITION");
    });
  });

  describe("approval, capacity, and creator-campaign membership", () => {
    it("approving creates a CreatorCampaign, and the creator's my-campaigns reflects ACTIVE", async () => {
      const creator = await makeCreator("approve-flow");
      const campaignId = await makeCampaign("approve-flow");
      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      const approved = await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      expect(approved.body.status).toBe("APPROVED");

      const membership = await prisma.creatorCampaign.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId: creator.creatorId } } });
      expect(membership?.status).toBe("ACTIVE");

      const myCampaigns = await request(app.getHttpServer()).get("/creator/my-campaigns").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const entry = myCampaigns.body.find((c: { campaignId: string }) => c.campaignId === campaignId);
      expect(entry?.status).toBe("ACTIVE");
    });

    it("approving beyond the campaign's creatorLimit is rejected with a typed CAMPAIGN_FULL, and a rejected approve leaves no CreatorCampaign row", async () => {
      const campaignId = await makeCampaign("capacity", { creatorLimit: 1 });
      const creatorFirst = await makeCreator("capacity-first");
      const creatorSecond = await makeCreator("capacity-second");

      async function toUnderReview(creator: Awaited<ReturnType<typeof makeCreator>>) {
        const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
        await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
        await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
        return created.body.id as string;
      }

      const firstAppId = await toUnderReview(creatorFirst);
      const secondAppId = await toUnderReview(creatorSecond);

      await request(app.getHttpServer()).post(`/admin/creator-applications/${firstAppId}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      const full = await request(app.getHttpServer()).post(`/admin/creator-applications/${secondAppId}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(409);
      expect(full.body.code).toBe("CAMPAIGN_FULL");

      const memberships = await prisma.creatorCampaign.count({ where: { campaignId, status: "ACTIVE" } });
      expect(memberships).toBe(1);
      const secondStillUnderReview = await prisma.campaignApplication.findUnique({ where: { id: secondAppId } });
      expect(secondStillUnderReview?.status).toBe("UNDER_REVIEW");
    });

    it("concurrent approvals against a capacity of 1 let exactly one succeed (SERIALIZABLE + retry)", async () => {
      const campaignId = await makeCampaign("concurrency", { creatorLimit: 1 });
      const creatorD = await makeCreator("concurrency-d");
      const creatorE = await makeCreator("concurrency-e");

      async function toUnderReview(creator: Awaited<ReturnType<typeof makeCreator>>) {
        const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
        await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
        await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
        return created.body.id as string;
      }

      const [appD, appE] = await Promise.all([toUnderReview(creatorD), toUnderReview(creatorE)]);

      const [resD, resE] = await Promise.all([
        request(app.getHttpServer()).post(`/admin/creator-applications/${appD}/approve`).set("Authorization", `Bearer ${adminAccessToken}`),
        request(app.getHttpServer()).post(`/admin/creator-applications/${appE}/approve`).set("Authorization", `Bearer ${adminAccessToken}`),
      ]);

      const statuses = [resD.status, resE.status].sort();
      expect(statuses).toEqual([201, 409]);

      const memberships = await prisma.creatorCampaign.count({ where: { campaignId, status: "ACTIVE" } });
      expect(memberships).toBe(1);
    });
  });

  describe("instant join (requiresApproval = false)", () => {
    it("submitting skips UNDER_REVIEW entirely and approves immediately", async () => {
      const creator = await makeCreator("instant");
      const campaignId = await makeCampaign("instant", { requiresApproval: false });
      const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
      const submitted = await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      expect(submitted.body.status).toBe("APPROVED");

      const membership = await prisma.creatorCampaign.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId: creator.creatorId } } });
      expect(membership?.status).toBe("ACTIVE");
    });

    it("instant join still respects capacity — CAMPAIGN_FULL once the limit is reached", async () => {
      const campaignId = await makeCampaign("instant-capacity", { requiresApproval: false, creatorLimit: 1 });
      const creatorFirst = await makeCreator("instant-capacity-first");
      const creatorSecond = await makeCreator("instant-capacity-second");

      const firstCreated = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creatorFirst.accessToken}`).send({}).expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${firstCreated.body.id}/submit`).set("Authorization", `Bearer ${creatorFirst.accessToken}`).expect(201);

      // The campaign is already at capacity from the first creator's instant approval — the
      // eligibility gate on create() (not just submit()) already sees CAMPAIGN_FULL, so a second
      // creator can't even open a DRAFT here, let alone submit one.
      const secondCreate = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creatorSecond.accessToken}`).send({}).expect(409);
      expect(secondCreate.body.code).toBe("CAMPAIGN_FULL");
    });
  });

  it("permission removal is effective on the very next request — a revoked application.approve immediately 403s", async () => {
    const campaignId = await makeCampaign("perm-removal");
    const creator = await makeCreator("perm-removal");
    const created = await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${creator.accessToken}`).send({}).expect(201);
    await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
    await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

    await prisma.rolePermission.deleteMany({ where: { roleId: adminRoleId, permissionId: approvePermissionId } });
    try {
      const res = await request(app.getHttpServer()).post(`/admin/creator-applications/${created.body.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    } finally {
      // restore so later tests in this file (none currently run after this, but future additions
      // might) aren't affected by suite ordering.
      await prisma.rolePermission.create({ data: { roleId: adminRoleId, permissionId: approvePermissionId } });
    }
  });
});
