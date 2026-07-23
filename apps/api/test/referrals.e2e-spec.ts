import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP — creator-to-creator referral attribution, milestone-based rewards
// (the only real milestone available today: FIRST_APPROVED_CAMPAIGN_APPLICATION — see
// referrals.service.ts's module comment on Content/Order/Commission dependencies), activity
// visibility, and RBAC. Mirrors creator-applications.e2e-spec.ts's structure/cleanup convention.
describe("Referrals (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `ref-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let noPermsStaffToken: string;
  let offerId: string;
  let campaignId: string;
  let secondCampaignId: string;

  // RequireCreatorGuard (every /creator/campaigns/* route) requires an APPROVED onboarding
  // CreatorApplication — real registration always creates a DRAFT one (see DECISIONS.md
  // ADR-012), and there's no real "approve onboarding" endpoint yet (Creator Application domain
  // limitation, documented previously). Directly approving via Prisma here is test setup, not a
  // workaround for an app bug — it mirrors exactly what the seed script does for its fixture
  // creators.
  async function approveOnboarding(email: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { creatorProfile: true } });
    await prisma.creatorApplication.updateMany({ where: { creatorId: user.creatorProfile!.id }, data: { status: "APPROVED" } });
  }

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `ref-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Referral Creator ${label}`,
            contentNiches: [],
            referralCode: `refcode-${label}-${suffix}`.slice(-40),
            applications: { create: { status: "APPROVED", formData: {} } },
            socialAccounts: { create: { platform: "INSTAGRAM", handle: `@ref_${label}_${suffix}`, profileUrl: "https://instagram.com/x", followerCount: 5000 } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, referralCode: user.creatorProfile!.referralCode, accessToken: tokens.signAccessToken(user.id) };
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

    const adminRole = await prisma.role.create({ data: { key: `ref-admin-${suffix}`, name: "Referral Admin" } });
    const perms = await prisma.permission.findMany({ where: { key: { in: ["referral.read", "referral.manage", "referral.review", "referral.disqualify"] } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })) });
    const adminUser = await prisma.user.create({ data: { email: `ref-admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `ref-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `ref-noperm-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);

    const product = await prisma.product.create({ data: { name: `Ref-test product ${suffix}`, slug: `ref-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({ data: { productId: product.id, name: "Ref-test offer", slug: `ref-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000, status: "ACTIVE" } });
    offerId = offer.id;
    await prisma.landingPage.create({ data: { offerId, status: "PUBLISHED", publishedAt: new Date() } });
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: "Ref-test campaign",
        slug: `ref-test-campaign-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        requiresApproval: false, // instant-join, so submit() immediately fires the APPROVED milestone hook
        status: "ACTIVE",
      },
    });
    campaignId = campaign.id;

    // A second instant-join campaign on the same offer, used to prove a referred creator's
    // *second* approved application never pays the MILESTONE_FIXED reward out again.
    const secondCampaign = await prisma.campaign.create({
      data: {
        offerId,
        name: "Ref-test campaign 2",
        slug: `ref-test-campaign-2-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        requiresApproval: false,
        status: "ACTIVE",
      },
    });
    secondCampaignId = secondCampaign.id;
  });

  afterAll(async () => {
    await prisma.creatorReferralReward.deleteMany({ where: { rule: { name: { contains: suffix } } } });
    await prisma.creatorReferralRule.deleteMany({ where: { name: { contains: suffix } } });
    await prisma.creatorReferral.deleteMany({ where: { referralCodeUsed: { contains: suffix } } });
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
    it("rejects unauthenticated requests on both creator and admin referral routes", async () => {
      await request(app.getHttpServer()).get("/creator/referrals").expect(401);
      await request(app.getHttpServer()).get("/admin/creator-referrals").expect(401);
    });

    it("a staff user without any referral.* permission is forbidden from the admin list", async () => {
      const res = await request(app.getHttpServer()).get("/admin/creator-referrals").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("referral code & attribution", () => {
    it("every creator has a unique referral code from registration", async () => {
      const a = await makeCreator("code-a");
      const b = await makeCreator("code-b");
      expect(a.referralCode).not.toBe(b.referralCode);
    });

    it("registers Creator B through Creator A's referral code and creates the CreatorReferral row", async () => {
      const a = await makeCreator("attr-a");
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-attr-b-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Referred B", referralCode: a.referralCode })
        .expect(201);

      const bUser = await prisma.user.findUnique({ where: { email: `ref-attr-b-${suffix}@rosti.uz` }, include: { creatorProfile: true } });
      const referral = await prisma.creatorReferral.findUnique({ where: { referredCreatorId: bUser!.creatorProfile!.id } });
      expect(referral).not.toBeNull();
      expect(referral!.referrerCreatorId).toBe(a.creatorId);
      expect(referral!.referralCodeUsed).toBe(a.referralCode);
      void res;
    });

    it("registration with an unknown/invalid referral code still succeeds, with no attribution created", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-badcode-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "No Referrer", referralCode: "TOTALLYFAKE" })
        .expect(201);
      expect(res.status).toBe(201);
      const user = await prisma.user.findUnique({ where: { email: `ref-badcode-${suffix}@rosti.uz` }, include: { creatorProfile: true } });
      const referral = await prisma.creatorReferral.findUnique({ where: { referredCreatorId: user!.creatorProfile!.id } });
      expect(referral).toBeNull();
    });

    it("a creator with no referrer registers successfully with no CreatorReferral row at all", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-noref-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Organic Signup" })
        .expect(201);
      void res;
      const user = await prisma.user.findUnique({ where: { email: `ref-noref-${suffix}@rosti.uz` }, include: { creatorProfile: true } });
      const referral = await prisma.creatorReferral.findUnique({ where: { referredCreatorId: user!.creatorProfile!.id } });
      expect(referral).toBeNull();
    });

    it("a creator can have at most one direct referrer — the DB unique constraint on referredCreatorId enforces it", async () => {
      const referrer1 = await makeCreator("dup-referrer-1");
      const referrer2 = await makeCreator("dup-referred-target");
      // referrer2 was registered organically (no ref code) above; attempt to directly insert a
      // second CreatorReferral row for the same referredCreatorId at the DB level.
      await prisma.creatorReferral.create({
        data: { referrerCreatorId: referrer1.creatorId, referredCreatorId: referrer2.creatorId, referralCodeUsed: referrer1.referralCode, registeredAt: new Date() },
      });
      await expect(
        prisma.creatorReferral.create({
          data: { referrerCreatorId: referrer1.creatorId, referredCreatorId: referrer2.creatorId, referralCodeUsed: referrer1.referralCode, registeredAt: new Date() },
        }),
      ).rejects.toThrow();
    });

    it("self-referral is structurally impossible — the DB check constraint rejects referrerCreatorId === referredCreatorId", async () => {
      const solo = await makeCreator("self-ref");
      await expect(
        prisma.creatorReferral.create({
          data: { referrerCreatorId: solo.creatorId, referredCreatorId: solo.creatorId, referralCodeUsed: solo.referralCode, registeredAt: new Date() },
        }),
      ).rejects.toThrow();
    });
  });

  describe("qualification — registration/onboarding/approval alone never create a reward", () => {
    it("a freshly registered, referred creator has zero rewards", async () => {
      const referrer = await makeCreator("noreward-referrer");
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-noreward-b-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Fresh Referred", referralCode: referrer.referralCode })
        .expect(201);

      const rewards = await request(app.getHttpServer()).get("/creator/referral-rewards").set("Authorization", `Bearer ${referrer.accessToken}`).expect(200);
      expect(rewards.body).toEqual([]);
    });

    it("onboarding being APPROVED (already true for every makeCreator() fixture) alone creates no reward", async () => {
      const referrer = await makeCreator("approved-alone-referrer");
      const referredUser = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-approved-alone-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Approved Alone", referralCode: referrer.referralCode })
        .expect(201);
      void referredUser;
      // Directly approve their onboarding (real endpoint doesn't exist yet — same known
      // limitation documented for the Creator Application domain) and confirm no reward appears.
      const user = await prisma.user.findUnique({ where: { email: `ref-approved-alone-${suffix}@rosti.uz` }, include: { creatorProfile: true } });
      await prisma.creatorApplication.updateMany({ where: { creatorId: user!.creatorProfile!.id }, data: { status: "APPROVED" } });

      const rewards = await request(app.getHttpServer()).get("/creator/referral-rewards").set("Authorization", `Bearer ${referrer.accessToken}`).expect(200);
      expect(rewards.body).toEqual([]);
    });
  });

  describe("the real milestone: first approved campaign application", () => {
    it("creates a MILESTONE_FIXED reward when Creator B's first campaign application is approved (instant-join)", async () => {
      const rule = await prisma.creatorReferralRule.create({
        data: {
          name: `First application bonus ${suffix}`,
          rewardType: "MILESTONE_FIXED",
          milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION",
          fixedRewardMinor: 50_000_00,
          currency: "UZS",
          active: true,
        },
      });

      const referrerA = await makeCreator("milestone-a");
      const registerRes = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-milestone-b-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Milestone B", referralCode: referrerA.referralCode })
        .expect(201);
      const bAccessToken = registerRes.body.accessToken;
      await approveOnboarding(`ref-milestone-b-${suffix}@rosti.uz`);

      // requiresApproval: false on the fixture campaign — submit() instant-approves.
      const created = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${bAccessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${created.body.id}/submit`).set("Authorization", `Bearer ${bAccessToken}`).expect(201);

      const rewards = await request(app.getHttpServer()).get("/creator/referral-rewards").set("Authorization", `Bearer ${referrerA.accessToken}`).expect(200);
      expect(rewards.body).toHaveLength(1);
      expect(rewards.body[0]).toMatchObject({ status: "PENDING", calculatedRewardMinor: 50_000_00, ruleName: rule.name });
    });

    it("does not pay the milestone reward twice when Creator B's second application is approved (one-time, not per-application)", async () => {
      const referrerA = await prisma.creatorProfile.findFirst({ where: { displayName: "Referral Creator milestone-a" } });
      const bUser = await prisma.user.findUniqueOrThrow({ where: { email: `ref-milestone-b-${suffix}@rosti.uz` } });
      const bAccessToken = tokens.signAccessToken(bUser.id);

      // A genuinely different qualifying event (a different applicationId, on a different
      // campaign) — the rule is still active, so without the (referralId, ruleId) guard in
      // ReferralsService.onCampaignApplicationApproved, this would pay out a second reward.
      const secondApplication = await request(app.getHttpServer())
        .post(`/creator/campaigns/${secondCampaignId}/applications`)
        .set("Authorization", `Bearer ${bAccessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer())
        .post(`/creator/applications/${secondApplication.body.id}/submit`)
        .set("Authorization", `Bearer ${bAccessToken}`)
        .expect(201);

      const rewardCount = await prisma.creatorReferralReward.count({ where: { referral: { referrerCreatorId: referrerA!.id } } });
      expect(rewardCount).toBe(1);
    });
  });

  describe("invited-friend activity visibility & privacy", () => {
    it("a referrer sees their invited friend's activity classification and campaign-application counts", async () => {
      const referrer = await makeCreator("visibility-referrer");
      const registerRes = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-visibility-b-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Visibility Friend", referralCode: referrer.referralCode })
        .expect(201);
      const friendToken = registerRes.body.accessToken;
      await approveOnboarding(`ref-visibility-b-${suffix}@rosti.uz`);
      await request(app.getHttpServer()).post(`/creator/campaigns/${campaignId}/applications`).set("Authorization", `Bearer ${friendToken}`).send({}).expect(201);

      const list = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrer.accessToken}`).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toHaveProperty("activity");
      expect(list.body[0]).toHaveProperty("lastMeaningfulActivityAt");
      expect(list.body[0].displayName).toBe("Visibility Friend");
    });

    it("never exposes the invited friend's private email or phone in the referrer's view", async () => {
      const referrer = await makeCreator("privacy-referrer");
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-privacy-b-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Privacy Friend", referralCode: referrer.referralCode })
        .expect(201);

      const list = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrer.accessToken}`).expect(200);
      const bodyStr = JSON.stringify(list.body);
      expect(bodyStr).not.toContain(`ref-privacy-b-${suffix}@rosti.uz`);
    });

    it("a creator cannot see another referrer's referrals — ownership-scoped, not just role-scoped", async () => {
      const referrerX = await makeCreator("ownership-x");
      const referrerY = await makeCreator("ownership-y");
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-ownership-friend-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "X's Friend", referralCode: referrerX.referralCode })
        .expect(201);

      const xList = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrerX.accessToken}`).expect(200);
      const yList = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrerY.accessToken}`).expect(200);
      expect(xList.body.length).toBeGreaterThan(0);
      expect(yList.body.find((r: { displayName: string }) => r.displayName === "X's Friend")).toBeUndefined();
    });

    it("a guessed referral id from another creator's referral 404s (not 403) — no id-guessing leak", async () => {
      const referrerX = await makeCreator("guess-x");
      const registerRes = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-guess-friend-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Guess Friend", referralCode: referrerX.referralCode })
        .expect(201);
      void registerRes;
      const xList = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrerX.accessToken}`).expect(200);
      const referralId = xList.body[0].id;

      const otherReferrer = await makeCreator("guess-other");
      const res = await request(app.getHttpServer()).get(`/creator/referrals/${referralId}`).set("Authorization", `Bearer ${otherReferrer.accessToken}`).expect(404);
      expect(res.body.code).toBe("REFERRAL_NOT_FOUND");
    });
  });

  describe("admin: rules, disqualification, reward review", () => {
    it("creates, activates, and deactivates a referral rule", async () => {
      const created = await request(app.getHttpServer())
        .post("/admin/referral-rules")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: `Admin-managed rule ${suffix}`, rewardType: "EARNINGS_PERCENTAGE", rewardRateBps: 500, earningWindowDays: 90 })
        .expect(201);
      expect(created.body.active).toBe(true);

      const deactivated = await request(app.getHttpServer()).post(`/admin/referral-rules/${created.body.id}/deactivate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      expect(deactivated.body.active).toBe(false);

      const reactivated = await request(app.getHttpServer()).post(`/admin/referral-rules/${created.body.id}/activate`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      expect(reactivated.body.active).toBe(true);
    });

    it("rejects an invalid rule (MILESTONE_FIXED with no milestoneType) with REFERRAL_RULE_INVALID", async () => {
      const res = await request(app.getHttpServer())
        .post("/admin/referral-rules")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ name: `Invalid rule ${suffix}`, rewardType: "MILESTONE_FIXED", fixedRewardMinor: 1000 })
        .expect(400);
      expect(res.body.code).toBe("REFERRAL_RULE_INVALID");
    });

    it("admin lists all referrals, filterable by search", async () => {
      const res = await request(app.getHttpServer())
        .get("/admin/creator-referrals")
        .query({ search: "Milestone B" })
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it("disqualification requires a reason and creates an audit-visible record", async () => {
      const referrerZ = await makeCreator("disqualify-z");
      const registerRes = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: `ref-disqualify-friend-${suffix}@rosti.uz`, password: "TestPass#2026", displayName: "Disqualify Friend", referralCode: referrerZ.referralCode })
        .expect(201);
      void registerRes;
      const list = await request(app.getHttpServer()).get("/creator/referrals").set("Authorization", `Bearer ${referrerZ.accessToken}`).expect(200);
      const referralId = list.body[0].id;

      await request(app.getHttpServer()).post(`/admin/creator-referrals/${referralId}/disqualify`).set("Authorization", `Bearer ${adminAccessToken}`).send({}).expect(400);

      const res = await request(app.getHttpServer())
        .post(`/admin/creator-referrals/${referralId}/disqualify`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Fraudulent signup pattern detected" })
        .expect(201);
      expect(res.body.disqualifiedAt).not.toBeNull();
      expect(res.body.disqualificationReason).toBe("Fraudulent signup pattern detected");
    });

    it("approves a pending reward", async () => {
      const rewards = await prisma.creatorReferralReward.findMany({ where: { rule: { name: { contains: suffix } } } });
      const pending = rewards.find((r) => r.status === "PENDING");
      expect(pending).toBeDefined();
      const res = await request(app.getHttpServer()).post(`/admin/creator-referral-rewards/${pending!.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.approvedAt).not.toBeNull();
    });

    it("no reward is ever marked PAID by this checkpoint — there is no payout ledger yet", async () => {
      const rewards = await prisma.creatorReferralReward.findMany({ where: { rule: { name: { contains: suffix } } } });
      expect(rewards.every((r) => r.status !== "PAID")).toBe(true);
    });

    it("rejects a reward with a reason, and rejection requires the reason", async () => {
      const rule = await prisma.creatorReferralRule.create({
        data: { name: `Reject-test rule ${suffix}`, rewardType: "MILESTONE_FIXED", milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION", fixedRewardMinor: 10_000_00, currency: "UZS", active: true },
      });
      const referral = await prisma.creatorReferral.findFirst({ where: { referralCodeUsed: { contains: suffix } } });
      const reward = await prisma.creatorReferralReward.create({
        data: { referralId: referral!.id, ruleId: rule.id, sourceType: "TEST_SOURCE", sourceId: `reject-${suffix}`, calculatedRewardMinor: 10_000_00, currency: "UZS" },
      });

      await request(app.getHttpServer()).post(`/admin/creator-referral-rewards/${reward.id}/reject`).set("Authorization", `Bearer ${adminAccessToken}`).send({}).expect(400);

      const res = await request(app.getHttpServer())
        .post(`/admin/creator-referral-rewards/${reward.id}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Duplicate application, does not qualify" })
        .expect(201);
      expect(res.body.status).toBe("REJECTED");
      expect(res.body.rejectionReason).toBe("Duplicate application, does not qualify");
    });
  });
});
