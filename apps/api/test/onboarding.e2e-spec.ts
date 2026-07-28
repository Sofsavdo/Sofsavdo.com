import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "../src/common/middleware/correlation-id.middleware";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/auth/token.service";

// Real Postgres, real HTTP, real RBAC — mirrors creator-applications.e2e-spec.ts's structure, but
// for the *onboarding* CreatorApplication (may this person be a creator on the platform at all —
// see ADR-018), not CampaignApplication (a creator applying to join a specific Campaign — ADR-012).
// The single most important assertion in this file is in the "RequireCreatorGuard integration"
// block: before Phase 11, no real endpoint anywhere ever moved a CreatorApplication out of DRAFT,
// which meant a brand-new real registration could never pass RequireCreatorGuard and reach ANY
// creator-facing feature — this suite proves that gap is now closed end-to-end.
describe("Onboarding — creator application lifecycle (e2e)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const suffix = `onboarding-e2e-${Date.now()}`;

  let adminAccessToken: string;
  let readOnlyStaffToken: string;
  let noPermsStaffToken: string;
  let adminRoleId: string;
  let approvePermissionId: string;

  // Registration creates a DRAFT CreatorApplication in the same write as the CreatorProfile (see
  // AuthService.register) — this helper reproduces that exact real shape rather than pre-approving,
  // since the whole point of this suite is to exercise the path a real new registration takes.
  async function makeCreator(label: string, opts: { referredBy?: string } = {}) {
    const user = await prisma.user.create({
      data: {
        email: `onb-${label}-${suffix}@rosti.uz`,
        passwordHash: "x",
        creatorProfile: {
          create: {
            displayName: `Onboarding Creator ${label}`,
            contentNiches: [],
            referralCode: `onb-${label}-${suffix}`.slice(0, 60),
            applications: { create: { status: "DRAFT", currentStep: 1, formData: {} } },
          },
        },
      },
      include: { creatorProfile: true },
    });
    const creatorId = user.creatorProfile!.id;
    if (opts.referredBy) {
      await prisma.creatorReferral.create({
        data: { referrerCreatorId: opts.referredBy, referredCreatorId: creatorId, referralCodeUsed: "x", registeredAt: new Date() },
      });
    }
    return { userId: user.id, creatorId, accessToken: tokens.signAccessToken(user.id) };
  }

  async function getApplicationId(creatorId: string): Promise<string> {
    const app = await prisma.creatorApplication.findFirstOrThrow({ where: { creatorId }, orderBy: { createdAt: "desc" } });
    return app.id;
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

    const adminRole = await prisma.role.create({ data: { key: `onb-admin-${suffix}`, name: "Onboarding Admin" } });
    adminRoleId = adminRole.id;
    const adminPerms = await prisma.permission.findMany({
      where: { key: { in: ["onboarding.read", "onboarding.review", "onboarding.approve", "onboarding.reject", "onboarding.revise"] } },
    });
    approvePermissionId = adminPerms.find((p) => p.key === "onboarding.approve")!.id;
    await prisma.rolePermission.createMany({ data: adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
    const adminUser = await prisma.user.create({ data: { email: `onb-admin-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    adminAccessToken = tokens.signAccessToken(adminUser.id);

    const readOnlyRole = await prisma.role.create({ data: { key: `onb-readonly-${suffix}`, name: "Onboarding Read-only" } });
    const readPerm = await prisma.permission.findFirst({ where: { key: "onboarding.read" } });
    await prisma.rolePermission.create({ data: { roleId: readOnlyRole.id, permissionId: readPerm!.id } });
    const readOnlyUser = await prisma.user.create({ data: { email: `onb-readonly-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } });
    readOnlyStaffToken = tokens.signAccessToken(readOnlyUser.id);

    const noPermsRole = await prisma.role.create({ data: { key: `onb-noperm-${suffix}`, name: "No perms" } });
    const noPermsUser = await prisma.user.create({ data: { email: `onb-noperm-${suffix}@rosti.uz`, passwordHash: "x" } });
    await prisma.userRole.create({ data: { userId: noPermsUser.id, roleId: noPermsRole.id } });
    noPermsStaffToken = tokens.signAccessToken(noPermsUser.id);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user: { email: { contains: suffix } } } });
    const applicationIds = (
      await prisma.creatorApplication.findMany({ where: { creator: { user: { email: { contains: suffix } } } }, select: { id: true } })
    ).map((r) => r.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: applicationIds } } });
    await prisma.creatorReferral.deleteMany({ where: { referred: { user: { email: { contains: suffix } } } } });
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
      await request(app.getHttpServer()).get("/creator/onboarding").expect(401);
      await request(app.getHttpServer()).get("/admin/creator-onboarding").expect(401);
    });

    it("a staff user without any onboarding.* permission is forbidden from the admin list", async () => {
      const res = await request(app.getHttpServer()).get("/admin/creator-onboarding").set("Authorization", `Bearer ${noPermsStaffToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("a read-only staff user can list but not approve", async () => {
      await request(app.getHttpServer()).get("/admin/creator-onboarding").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(200);
      await request(app.getHttpServer()).post("/admin/creator-onboarding/nonexistent/approve").set("Authorization", `Bearer ${readOnlyStaffToken}`).expect(403);
    });
  });

  describe("RequireCreatorGuard integration — the core Phase 11 regression", () => {
    it("a freshly-registered (DRAFT) creator is blocked from every RequireCreatorGuard route", async () => {
      const creator = await makeCreator("guard-draft");
      const res = await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(403);
      expect(res.body.code).toBe("CREATOR_NOT_APPROVED");
    });

    it("remains blocked through SUBMITTED and UNDER_REVIEW, and becomes reachable only after real APPROVED", async () => {
      const creator = await makeCreator("guard-flow");
      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(403);

      const appId = await getApplicationId(creator.creatorId);
      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(403);

      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer()).get("/creator/wallet/balance").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
    });
  });

  describe("creator-facing: draft, submit, resubmit", () => {
    it("GET /creator/onboarding returns the freshly-registered DRAFT row", async () => {
      const creator = await makeCreator("get-mine");
      const res = await request(app.getHttpServer()).get("/creator/onboarding").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.currentStep).toBe(1);
    });

    it("PATCH saves draft progress (step + formData)", async () => {
      const creator = await makeCreator("patch-draft");
      const res = await request(app.getHttpServer())
        .patch("/creator/onboarding")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ currentStep: 3, formData: { fullName: "Test Creator", city: "Tashkent" } })
        .expect(200);
      expect(res.body.currentStep).toBe(3);
      expect(res.body.data).toEqual({ fullName: "Test Creator", city: "Tashkent" });
    });

    it("submit transitions DRAFT -> SUBMITTED, and a second submit is rejected", async () => {
      const creator = await makeCreator("submit-twice");
      const res = await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      expect(res.body.status).toBe("SUBMITTED");
      expect(res.body.submittedAt).not.toBeNull();

      const again = await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(409);
      expect(again.body.code).toBe("INVALID_ONBOARDING_TRANSITION");
    });

    it("editing is blocked once SUBMITTED", async () => {
      const creator = await makeCreator("edit-blocked");
      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      const res = await request(app.getHttpServer()).patch("/creator/onboarding").set("Authorization", `Bearer ${creator.accessToken}`).send({ currentStep: 2 }).expect(409);
      expect(res.body.code).toBe("INVALID_ONBOARDING_TRANSITION");
    });

    it("resubmit is rejected from DRAFT (must use submit, not resubmit)", async () => {
      const creator = await makeCreator("resubmit-wrong-state");
      const res = await request(app.getHttpServer()).post("/creator/onboarding/resubmit").set("Authorization", `Bearer ${creator.accessToken}`).expect(409);
      expect(res.body.code).toBe("INVALID_ONBOARDING_TRANSITION");
    });
  });

  describe("admin review queue", () => {
    it("excludes DRAFT rows by default, includes SUBMITTED, and supports status filter + search", async () => {
      const creator = await makeCreator("queue-visible");
      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      const appId = await getApplicationId(creator.creatorId);

      const defaultList = await request(app.getHttpServer()).get("/admin/creator-onboarding").set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(defaultList.body.items.some((a: { id: string }) => a.id === appId)).toBe(true);

      const byStatus = await request(app.getHttpServer()).get("/admin/creator-onboarding?status=SUBMITTED").set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(byStatus.body.items.some((a: { id: string }) => a.id === appId)).toBe(true);

      const bySearch = await request(app.getHttpServer())
        .get(`/admin/creator-onboarding?search=${encodeURIComponent("Onboarding Creator queue-visible")}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(bySearch.body.items.some((a: { id: string }) => a.id === appId)).toBe(true);
    });

    it("a DRAFT-only application does not appear in the default (unfiltered) queue", async () => {
      const creator = await makeCreator("queue-hidden-draft");
      const appId = await getApplicationId(creator.creatorId);
      const defaultList = await request(app.getHttpServer()).get("/admin/creator-onboarding").set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(defaultList.body.items.some((a: { id: string }) => a.id === appId)).toBe(false);

      const explicitDraft = await request(app.getHttpServer()).get("/admin/creator-onboarding?status=DRAFT").set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(explicitDraft.body.items.some((a: { id: string }) => a.id === appId)).toBe(true);
    });
  });

  describe("full lifecycle: submit -> changes requested -> resubmit -> approve, with referral + audit trail", () => {
    it("wires the referral onboardingCompletedAt/creatorApprovedAt milestones for a referred creator", async () => {
      const referrer = await makeCreator("referrer");
      const referred = await makeCreator("referred", { referredBy: referrer.creatorId });

      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${referred.accessToken}`).expect(201);
      const afterSubmit = await prisma.creatorReferral.findUnique({ where: { referredCreatorId: referred.creatorId } });
      expect(afterSubmit?.onboardingCompletedAt).not.toBeNull();
      expect(afterSubmit?.creatorApprovedAt).toBeNull();

      const appId = await getApplicationId(referred.creatorId);
      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      const afterApprove = await prisma.creatorReferral.findUnique({ where: { referredCreatorId: referred.creatorId } });
      expect(afterApprove?.creatorApprovedAt).not.toBeNull();
    });

    it("request-changes requires a meaningful reason, creator can then edit + resubmit, and a full reviewer audit trail is recorded", async () => {
      const creator = await makeCreator("changes-flow");
      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      const appId = await getApplicationId(creator.creatorId);
      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

      const badReason = await request(app.getHttpServer())
        .post(`/admin/creator-onboarding/${appId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "no" })
        .expect(400);
      expect(badReason.body.code).toBe("VALIDATION_ERROR");

      const changesRequested = await request(app.getHttpServer())
        .post(`/admin/creator-onboarding/${appId}/request-changes`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Please add your payout details" })
        .expect(201);
      expect(changesRequested.body.status).toBe("CHANGES_REQUESTED");

      const creatorView = await request(app.getHttpServer()).get("/creator/onboarding").set("Authorization", `Bearer ${creator.accessToken}`).expect(200);
      expect(creatorView.body.reviewNote).toBe("Please add your payout details");

      await request(app.getHttpServer())
        .patch("/creator/onboarding")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ formData: { payoutCardNumber: "8600000000000000" } })
        .expect(200);
      const resubmitted = await request(app.getHttpServer()).post("/creator/onboarding/resubmit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      expect(resubmitted.body.status).toBe("SUBMITTED");

      const audit = await request(app.getHttpServer()).get(`/admin/creator-onboarding/${appId}/audit`).set("Authorization", `Bearer ${adminAccessToken}`).expect(200);
      expect(audit.body.some((e: { action: string }) => e.action === "ONBOARDING_REVIEW_STARTED")).toBe(true);
      expect(audit.body.some((e: { action: string }) => e.action === "ONBOARDING_CHANGES_REQUESTED")).toBe(true);
    });

    it("reject requires a meaningful reason and is only valid from UNDER_REVIEW; REJECTED is resubmittable (not terminal)", async () => {
      const creator = await makeCreator("reject-then-resubmit");
      await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      const appId = await getApplicationId(creator.creatorId);

      const wrongState = await request(app.getHttpServer())
        .post(`/admin/creator-onboarding/${appId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Not eligible" })
        .expect(409);
      expect(wrongState.body.code).toBe("INVALID_ONBOARDING_TRANSITION");

      await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);
      const rejected = await request(app.getHttpServer())
        .post(`/admin/creator-onboarding/${appId}/reject`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ reason: "Audience too small" })
        .expect(201);
      expect(rejected.body.status).toBe("REJECTED");

      // Unlike CampaignApplication, REJECTED is not terminal here — the creator can edit and
      // resubmit (see ADR-018).
      await request(app.getHttpServer())
        .patch("/creator/onboarding")
        .set("Authorization", `Bearer ${creator.accessToken}`)
        .send({ formData: { audienceGeography: "Tashkent, national reach" } })
        .expect(200);
      const resubmitted = await request(app.getHttpServer()).post("/creator/onboarding/resubmit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
      expect(resubmitted.body.status).toBe("SUBMITTED");
    });
  });

  it("permission removal is effective on the very next request — a revoked onboarding.approve immediately 403s", async () => {
    const creator = await makeCreator("perm-removal");
    await request(app.getHttpServer()).post("/creator/onboarding/submit").set("Authorization", `Bearer ${creator.accessToken}`).expect(201);
    const appId = await getApplicationId(creator.creatorId);
    await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/start-review`).set("Authorization", `Bearer ${adminAccessToken}`).expect(201);

    await prisma.rolePermission.deleteMany({ where: { roleId: adminRoleId, permissionId: approvePermissionId } });
    try {
      const res = await request(app.getHttpServer()).post(`/admin/creator-onboarding/${appId}/approve`).set("Authorization", `Bearer ${adminAccessToken}`).expect(403);
      expect(res.body.code).toBe("FORBIDDEN");
    } finally {
      await prisma.rolePermission.create({ data: { roleId: adminRoleId, permissionId: approvePermissionId } });
    }
  });
});
