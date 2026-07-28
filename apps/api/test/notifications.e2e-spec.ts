import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";
import { NotificationSweepService } from "../src/notifications/notification-sweep.service";

// Real Postgres, real HTTP — the Phase 10 Communication & Notification domain: campaign
// application lifecycle notifications (real direct EventEmitter2 emits from
// CreatorApplicationsService), sweep-triggered Commission/Payout notifications (Phase 8/9 data,
// invoked directly on the NotificationSweepService instance rather than waiting out its real
// 30s @Interval), mark read/all-read, preferences gating channel dispatch, a real FAILED delivery
// (SMTP is intentionally unconfigured in this test env) and its admin retry, and RBAC. Mirrors
// wallet-payouts.e2e-spec.ts's fixture/cleanup conventions.
describe("Notifications (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let sweep: NotificationSweepService;
  const suffix = `notif-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let noPermsStaffToken: string;
  let offerId: string;

  async function makeCreator(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `notif-creator-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Notif Creator ${label}`,
            contentNiches: [],
            referralCode: `ntf-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "APPROVED", formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    return { userId: user.id, creatorId: user.creatorProfile!.id, accessToken: tokens.signAccessToken(user.id) };
  }

  async function makeCampaign(slugSuffix: string, requiresApproval: boolean) {
    const campaign = await prisma.campaign.create({
      data: {
        offerId,
        name: `Notif-test campaign ${slugSuffix}`,
        slug: `notif-test-campaign-${slugSuffix}-${suffix}`,
        category: "beauty",
        ctaLabel: "Join",
        platforms: ["INSTAGRAM"],
        contentFormats: ["reels"],
        commissionType: "PERCENTAGE",
        commissionRateBps: 2000,
        status: "ACTIVE",
        requiresApproval,
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
    sweep = app.get(NotificationSweepService);

    const adminRole = await prisma.role.create({ data: { key: `notif-admin-${suffix}`, name: "Notif Admin" } });
    const adminPerms = await prisma.permission.findMany({
      where: { key: { in: ["application.review", "application.approve", "application.reject", "notification.read", "notification.manage"] } },
    });
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `notif-admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `notif-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `notif-noperm-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);

    const product = await prisma.product.create({ data: { name: `Notif-test product ${suffix}`, slug: `notif-test-product-${suffix}`, type: "PHYSICAL_PRODUCT" } });
    const offer = await prisma.offer.create({
      data: { productId: product.id, name: `Notif-test offer ${suffix}`, slug: `notif-test-offer-${suffix}`, headline: "Test", priceMinor: 100_000_00, status: "ACTIVE" },
    });
    offerId = offer.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.notificationPreference.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.commissionLedger.deleteMany({ where: { commission: { creator: { displayName: { contains: "Notif Creator" } } } } });
    await prisma.commission.deleteMany({ where: { creator: { displayName: { contains: "Notif Creator" } } } });
    await prisma.payout.deleteMany({ where: { creator: { displayName: { contains: "Notif Creator" } } } });
    await prisma.payoutMethod.deleteMany({ where: { creator: { displayName: { contains: "Notif Creator" } } } });
    await prisma.order.deleteMany({ where: { offer: { slug: { contains: suffix } } } });
    await prisma.customer.deleteMany({ where: { fullName: { contains: suffix } } });
    await prisma.campaignApplication.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.creatorCampaign.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.commissionRule.deleteMany({ where: { campaign: { slug: { contains: suffix } } } });
    await prisma.campaign.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.offer.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.product.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "Notification" } });
    await prisma.creatorApplication.deleteMany({ where: { creator: { user: { email: { contains: suffix } } } } });
    await prisma.creatorProfile.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: suffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.rolePermission.deleteMany({ where: { role: { key: { contains: suffix } } } });
    await prisma.role.deleteMany({ where: { key: { contains: suffix } } });
    await moduleRef.close();
  });

  describe("campaign application lifecycle (real direct emits)", () => {
    it("notifies both the creator and admins when an application is submitted (review-required campaign)", async () => {
      const creator = await makeCreator("submit");
      const campaignId = await makeCampaign("review", true);

      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);

      const creatorNotifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(creatorNotifs.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: "campaign_application.submitted", channel: "IN_APP" })]));

      const adminNotifs = await request(app.getHttpServer())
        .get("/admin/notifications")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .query({ type: "campaign_application.new" })
        .expect(200);
      expect(adminNotifs.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it("notifies the creator with both 'approved' and 'joined' once an admin approves", async () => {
      const creator = await makeCreator("approve");
      const campaignId = await makeCampaign("approveflow", true);
      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/creator-applications/${createRes.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/creator-applications/${createRes.body.id}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      const creatorNotifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const types = creatorNotifs.body.items.map((n: { type: string }) => n.type);
      expect(types).toEqual(expect.arrayContaining(["campaign_application.approved", "campaign.joined"]));
    });

    it("notifies the creator with the rejection reason once an admin rejects", async () => {
      const creator = await makeCreator("reject");
      const campaignId = await makeCampaign("rejectflow", true);
      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/creator-applications/${createRes.body.id}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer())
        .post(`/admin/creator-applications/${createRes.body.id}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Obunachilar soni yetarli emas" })
        .expect(201);

      const creatorNotifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const rejected = creatorNotifs.body.items.find((n: { type: string }) => n.type === "campaign_application.rejected");
      expect(rejected.payload.reason).toBe("Obunachilar soni yetarli emas");
    });
  });

  describe("read state", () => {
    it("marks a single notification read, and mark-all-read clears every remaining unread one", async () => {
      const creator = await makeCreator("readstate");
      const campaignId = await makeCampaign("readstate", false); // instant-approve -> two notifications in one call
      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);

      const before = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(before.body.items.length).toBeGreaterThanOrEqual(2);
      const first = before.body.items[0];

      await request(app.getHttpServer()).patch(`/creator/notifications/${first.id}/read`).set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const afterOne = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).query({ unreadOnly: true }).expect(200);
      expect(afterOne.body.items.find((n: { id: string }) => n.id === first.id)).toBeUndefined();

      await request(app.getHttpServer()).post("/creator/notifications/mark-all-read").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      const afterAll = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).query({ unreadOnly: true }).expect(200);
      expect(afterAll.body.items).toHaveLength(0);
    });
  });

  describe("preferences gate channel dispatch", () => {
    it("returns all 6 categories with sensible defaults for a creator who has never touched them", async () => {
      const creator = await makeCreator("prefdefaults");
      const res = await request(app.getHttpServer()).get("/creator/notification-preferences").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(res.body).toHaveLength(6);
      expect(res.body).toEqual(expect.arrayContaining([{ category: "PAYOUT", inApp: true, telegram: false, email: true }]));
    });

    it("disabling in-app for CAMPAIGN_APPLICATION stops future in-app notifications for that category", async () => {
      const creator = await makeCreator("prefdisabled");
      await request(app.getHttpServer())
        .patch("/creator/notification-preferences/CAMPAIGN_APPLICATION")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ inApp: false })
        .expect(200);

      const campaignId = await makeCampaign("prefdisabled", true);
      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creator.accessToken}`).expect(201);

      // Only IN_APP was disabled — EMAIL defaults to enabled (every email this domain sends is
      // transactional, see DECISIONS.md ADR-017), so a "campaign_application.submitted" EMAIL row
      // is still expected (and will be FAILED, since SMTP is unconfigured in this env — a separate
      // concern from preference gating). Assert on the IN_APP channel specifically, not the
      // absence of every row regardless of channel.
      const notifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).query({ channel: "IN_APP" }).expect(200);
      expect(notifs.body.items).toHaveLength(0);
    });
  });

  describe("sweep-triggered notifications (Phase 8/9 data, invoked directly rather than waiting 30s)", () => {
    it("notifies a creator when their commission becomes PAYABLE", async () => {
      const creator = await makeCreator("sweepcommission");
      const customer = await prisma.customer.create({ data: { fullName: `Notif Sweep Customer ${suffix}`, phone: `+998907${Date.now()}`.slice(0, 16) } });
      const campaignId = await makeCampaign("sweepcomm", false);
      const order = await prisma.order.create({
        data: {
          idempotencyKey: `${suffix}-sweep-${Math.random()}`,
          type: "PHYSICAL",
          offerId,
          campaignId,
          customerId: customer.id,
          status: "PAID",
          offerSnapshot: {},
          subtotalMinor: 50_000_00,
          totalMinor: 50_000_00,
          currency: "UZS",
        },
      });
      const rule = await prisma.commissionRule.create({ data: { campaignId, commissionType: "PERCENTAGE", commissionRateBps: 2000 } });
      await prisma.commission.create({
        data: { orderId: order.id, creatorId: creator.creatorId, commissionRuleId: rule.id, baseAmountMinor: 50_000_00, amountMinor: 10_000_00, status: "PAYABLE", payableAt: new Date() },
      });

      await sweep.sweep();

      const notifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(notifs.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: "commission.payable" })]));

      // Re-running the sweep must never double-notify for the same commission (dedupKey). One row
      // per enabled channel is still correct — COMMISSION's default preference has both IN_APP and
      // EMAIL enabled, so exactly one of each is expected, never two of either.
      await sweep.sweep();
      const notifsAgain = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      const payableNotifs = notifsAgain.body.items.filter((n: { type: string }) => n.type === "commission.payable");
      expect(payableNotifs).toHaveLength(2);
      expect(payableNotifs.map((n: { channel: string }) => n.channel).sort()).toEqual(["EMAIL", "IN_APP"]);
    });

    it("notifies both the creator and admins when a payout is REQUESTED", async () => {
      const creator = await makeCreator("sweeppayout");
      const method = await prisma.payoutMethod.create({ data: { creatorId: creator.creatorId, type: "CARD", cardNumberEnc: "iv:tag:cipher", cardHolder: "Test", isDefault: true } });
      await prisma.payout.create({ data: { creatorId: creator.creatorId, payoutMethodId: method.id, amountMinor: 100_000_00, status: "REQUESTED" } });

      await sweep.sweep();

      const creatorNotifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(creatorNotifs.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: "payout.requested" })]));
      const adminNotifs = await request(app.getHttpServer())
        .get("/admin/notifications")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .query({ type: "payout.requested.admin" })
        .expect(200);
      expect(adminNotifs.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("admin failed-delivery queue and retry (real failure — SMTP unconfigured in this env)", () => {
    it(
      "surfaces a FAILED email delivery in the admin failed queue and lets an admin retry it",
      async () => {
        const registerRes = await request(app.getHttpServer())
          .post("/auth/register")
          .send({ email: `notif-welcome-${suffix}@rosti.uz`, password: "Str0ngPass!1", displayName: "Welcome Test" })
          .expect(201);
        void registerRes;

        const failedRes = await request(app.getHttpServer())
          .get("/admin/notifications/failed")
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .query({ type: "user.registered" })
          .expect(200);
        expect(failedRes.body.items.length).toBeGreaterThanOrEqual(1);
        const failedNotification = failedRes.body.items[0];
        expect(failedNotification.status).toBe("FAILED");
        expect(failedNotification.error).toBeTruthy();

        const retryRes = await request(app.getHttpServer())
          .post(`/admin/notifications/${failedNotification.id}/retry`)
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .expect(201);
        // Retrying against the same unconfigured SMTP still fails — this asserts the retry path
        // actually re-attempted delivery (attempts incremented), not that it magically succeeds.
        expect(retryRes.body.attempts).toBeGreaterThan(failedNotification.attempts);
      },
      20_000,
    );
  });

  describe("RBAC", () => {
    it("rejects admin notification queue access without notification.read", async () => {
      await request(app.getHttpServer()).get("/admin/notifications").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("rejects retry without notification.manage", async () => {
      await request(app.getHttpServer()).post("/admin/notifications/nonexistent/retry").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
    });

    it("rejects a creator reading another creator's notification (no id-guessing oracle)", async () => {
      const creatorA = await makeCreator("ownera");
      const creatorB = await makeCreator("ownerb");
      const campaignId = await makeCampaign("ownercheck", false);
      const createRes = await request(app.getHttpServer())
        .post(`/creator/campaigns/${campaignId}/applications`)
        .set("Authorization", `Bearer ${creatorA.accessToken}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer()).post(`/creator/applications/${createRes.body.id}/submit`).set("Authorization", `Bearer ${creatorA.accessToken}`).expect(201);
      const notifs = await request(app.getHttpServer()).get("/creator/notifications").set("Authorization", `Bearer ${creatorA.accessToken}`).expect(200);
      const notificationId = notifs.body.items[0].id;

      const res = await request(app.getHttpServer()).get(`/creator/notifications/${notificationId}`).set("Authorization", `Bearer ${creatorB.accessToken}`).expect(404);
      expect(res.body.code).toBe("NOTIFICATION_NOT_FOUND");
    });
  });
});
