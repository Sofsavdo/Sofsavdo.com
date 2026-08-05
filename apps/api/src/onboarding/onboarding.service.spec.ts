import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OnboardingService } from "./onboarding.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";
import { NOTIFICATION_EVENTS } from "../notifications/events";

describe("OnboardingService", () => {
  let service: OnboardingService;
  let prisma: {
    creatorApplication: { findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
    creatorProfile: { findUniqueOrThrow: jest.Mock };
  };
  let referrals: { onOnboardingSubmitted: jest.Mock; onCreatorApproved: jest.Mock };
  let audit: { record: jest.Mock; listForEntity: jest.Mock };
  let events: { emitAsync: jest.Mock };

  const baseApp = (over: Record<string, unknown> = {}) => ({
    id: "app1",
    creatorId: "creator1",
    status: "DRAFT",
    currentStep: 1,
    formData: {},
    reviewNote: null,
    reviewedById: null,
    reviewedAt: null,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const withCreator = (over: Record<string, unknown> = {}) => ({
    ...baseApp(over),
    creator: { id: "creator1", displayName: "Test Creator", city: null, user: { email: "creator@example.uz" } },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      creatorApplication: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
      creatorProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "creator1", displayName: "Test Creator" }) },
    };
    referrals = { onOnboardingSubmitted: jest.fn(), onCreatorApproved: jest.fn() };
    audit = { record: jest.fn(), listForEntity: jest.fn().mockResolvedValue([]) };
    events = { emitAsync: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReferralsService, useValue: referrals },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  describe("creator-facing", () => {
    it("getMine throws NOT_FOUND when no application row exists", async () => {
      prisma.creatorApplication.findFirst.mockResolvedValue(null);
      await expect(service.getMine("creator1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("getMine returns the creator-safe shape", async () => {
      prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status: "CHANGES_REQUESTED", reviewNote: "Fix your city" }));
      const result = await service.getMine("creator1");
      expect(result).toEqual({ id: "app1", status: "CHANGES_REQUESTED", currentStep: 1, data: {}, reviewNote: "Fix your city", submittedAt: null, reviewedAt: null });
    });

    describe("updateDraft", () => {
      it.each(["DRAFT", "CHANGES_REQUESTED", "REJECTED"])("allows editing from %s", async (status) => {
        prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status }));
        prisma.creatorApplication.update.mockResolvedValue(baseApp({ status, currentStep: 2, formData: { city: "Tashkent" } }));
        const result = await service.updateDraft("creator1", { currentStep: 2, formData: { city: "Tashkent" } });
        expect(result.currentStep).toBe(2);
        expect(prisma.creatorApplication.update).toHaveBeenCalledWith({
          where: { id: "app1" },
          data: { currentStep: 2, formData: { city: "Tashkent" } },
        });
      });

      it.each(["SUBMITTED", "UNDER_REVIEW", "APPROVED"])("throws INVALID_ONBOARDING_TRANSITION from %s", async (status) => {
        prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status }));
        await expect(service.updateDraft("creator1", { currentStep: 2 })).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });

    describe("submit", () => {
      it("transitions DRAFT -> SUBMITTED -> APPROVED in one call (admin review temporarily disabled), firing both the submit and approve side effects", async () => {
        prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status: "DRAFT" }));
        prisma.creatorApplication.update
          .mockResolvedValueOnce(baseApp({ status: "SUBMITTED", submittedAt: new Date() }))
          .mockResolvedValueOnce(baseApp({ status: "APPROVED", submittedAt: new Date(), reviewedAt: new Date(), reviewedById: null }));

        const result = await service.submit("creator1");

        expect(result.status).toBe("APPROVED");
        expect(prisma.creatorApplication.update).toHaveBeenNthCalledWith(1, {
          where: { id: "app1" },
          data: { status: "SUBMITTED", submittedAt: expect.any(Date) },
        });
        expect(prisma.creatorApplication.update).toHaveBeenNthCalledWith(2, {
          where: { id: "app1" },
          data: expect.objectContaining({ status: "APPROVED", reviewedById: null }),
        });
        expect(referrals.onOnboardingSubmitted).toHaveBeenCalledWith("creator1");
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_SUBMITTED, {
          applicationId: "app1",
          creatorId: "creator1",
          creatorName: "Test Creator",
        });
        // Same side effects the manual admin approve() path runs — auto-approval must not skip any of these.
        expect(referrals.onCreatorApproved).toHaveBeenCalledWith("creator1");
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_APPROVED, {
          applicationId: "app1",
          creatorId: "creator1",
          creatorName: "Test Creator",
        });
        expect(audit.record).toHaveBeenCalledWith(
          expect.objectContaining({ actorId: null, action: "ONBOARDING_APPROVED", before: { status: "SUBMITTED" } }),
        );
      });

      it.each(["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"])(
        "throws INVALID_ONBOARDING_TRANSITION from %s",
        async (status) => {
          prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status }));
          await expect(service.submit("creator1")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
        },
      );
    });

    describe("resubmit", () => {
      it.each(["CHANGES_REQUESTED", "REJECTED"])("transitions %s -> SUBMITTED -> APPROVED (admin review temporarily disabled)", async (status) => {
        prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status }));
        prisma.creatorApplication.update
          .mockResolvedValueOnce(baseApp({ status: "SUBMITTED", submittedAt: new Date() }))
          .mockResolvedValueOnce(baseApp({ status: "APPROVED", submittedAt: new Date() }));
        const result = await service.resubmit("creator1");
        expect(result.status).toBe("APPROVED");
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_SUBMITTED, expect.any(Object));
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_APPROVED, expect.any(Object));
      });

      it.each(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"])("throws INVALID_ONBOARDING_TRANSITION from %s", async (status) => {
        prisma.creatorApplication.findFirst.mockResolvedValue(baseApp({ status }));
        await expect(service.resubmit("creator1")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });
  });

  describe("admin-facing", () => {
    describe("startReview", () => {
      it("transitions SUBMITTED -> UNDER_REVIEW and records an audit entry", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "SUBMITTED" }));
        prisma.creatorApplication.update.mockResolvedValue(undefined);

        await service.startReview("app1", "admin1");

        expect(prisma.creatorApplication.update).toHaveBeenCalledWith({ where: { id: "app1" }, data: { status: "UNDER_REVIEW" } });
        expect(audit.record).toHaveBeenCalledWith(
          expect.objectContaining({ actorId: "admin1", action: "ONBOARDING_REVIEW_STARTED", entityType: "CreatorApplication", entityId: "app1" }),
        );
      });

      it("throws INVALID_ONBOARDING_TRANSITION when not SUBMITTED", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "DRAFT" }));
        await expect(service.startReview("app1", "admin1")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });

    describe("approve", () => {
      it("transitions UNDER_REVIEW -> APPROVED, fires the referral hook, audits, and emits", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "UNDER_REVIEW" }));
        prisma.creatorApplication.update.mockResolvedValue(undefined);

        await service.approve("app1", "admin1");

        expect(prisma.creatorApplication.update).toHaveBeenCalledWith({
          where: { id: "app1" },
          data: { status: "APPROVED", reviewedAt: expect.any(Date), reviewedById: "admin1" },
        });
        expect(referrals.onCreatorApproved).toHaveBeenCalledWith("creator1");
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ONBOARDING_APPROVED" }));
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_APPROVED, {
          applicationId: "app1",
          creatorId: "creator1",
          creatorName: "Test Creator",
        });
      });

      it("throws INVALID_ONBOARDING_TRANSITION when not UNDER_REVIEW", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "SUBMITTED" }));
        await expect(service.approve("app1", "admin1")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });

    describe("reject", () => {
      it("transitions UNDER_REVIEW -> REJECTED with a reason, audits, and emits", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "UNDER_REVIEW" }));
        prisma.creatorApplication.update.mockResolvedValue(undefined);

        await service.reject("app1", "admin1", "Not enough audience data");

        expect(prisma.creatorApplication.update).toHaveBeenCalledWith({
          where: { id: "app1" },
          data: { status: "REJECTED", reviewNote: "Not enough audience data", reviewedAt: expect.any(Date), reviewedById: "admin1" },
        });
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ONBOARDING_REJECTED" }));
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_REJECTED, {
          applicationId: "app1",
          creatorId: "creator1",
          creatorName: "Test Creator",
          reason: "Not enough audience data",
        });
        // REJECTED is resubmittable in this domain (unlike CampaignApplication) — no referral hook
        // fires here since rejection isn't a milestone.
        expect(referrals.onCreatorApproved).not.toHaveBeenCalled();
      });

      it("throws INVALID_ONBOARDING_TRANSITION when not UNDER_REVIEW", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "SUBMITTED" }));
        await expect(service.reject("app1", "admin1", "reason")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });

    describe("requestChanges", () => {
      it("transitions UNDER_REVIEW -> CHANGES_REQUESTED with a reason, audits, and emits", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "UNDER_REVIEW" }));
        prisma.creatorApplication.update.mockResolvedValue(undefined);

        await service.requestChanges("app1", "admin1", "Please add your bank details");

        expect(prisma.creatorApplication.update).toHaveBeenCalledWith({
          where: { id: "app1" },
          data: { status: "CHANGES_REQUESTED", reviewNote: "Please add your bank details", reviewedAt: expect.any(Date), reviewedById: "admin1" },
        });
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ONBOARDING_CHANGES_REQUESTED" }));
        expect(events.emitAsync).toHaveBeenCalledWith(NOTIFICATION_EVENTS.ONBOARDING_CHANGES_REQUESTED, {
          applicationId: "app1",
          creatorId: "creator1",
          creatorName: "Test Creator",
          reason: "Please add your bank details",
        });
      });

      it("throws INVALID_ONBOARDING_TRANSITION when not UNDER_REVIEW", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator({ status: "SUBMITTED" }));
        await expect(service.requestChanges("app1", "admin1", "reason")).rejects.toMatchObject({ code: "INVALID_ONBOARDING_TRANSITION" });
      });
    });

    describe("list", () => {
      it("excludes DRAFT rows unless explicitly filtered for", async () => {
        prisma.creatorApplication.findMany.mockResolvedValue([]);
        prisma.creatorApplication.count.mockResolvedValue(0);
        await service.list({ page: 1, pageSize: 20, skip: 0, take: 20 });
        expect(prisma.creatorApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: { not: "DRAFT" } }) }),
        );
      });

      it("includes DRAFT rows when explicitly filtered for", async () => {
        prisma.creatorApplication.findMany.mockResolvedValue([]);
        prisma.creatorApplication.count.mockResolvedValue(0);
        await service.list({ status: "DRAFT", page: 1, pageSize: 20, skip: 0, take: 20 } as never);
        const where = prisma.creatorApplication.findMany.mock.calls[0][0].where;
        expect(where.status).toBe("DRAFT");
      });
    });

    describe("getAuditTrail", () => {
      it("404s for an unknown id instead of returning an empty trail", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(null);
        await expect(service.getAuditTrail("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(audit.listForEntity).not.toHaveBeenCalled();
      });

      it("delegates to AuditService.listForEntity for a known id", async () => {
        prisma.creatorApplication.findUnique.mockResolvedValue(withCreator());
        await service.getAuditTrail("app1");
        expect(audit.listForEntity).toHaveBeenCalledWith("CreatorApplication", "app1");
      });
    });
  });
});
