import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CompetitionsService } from "./competitions.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsCacheService } from "../analytics/lib/analytics-cache.service";
import { AuditService } from "../common/audit/audit.service";
import { INSTAGRAM_VIEWS_PORT } from "./instagram-views.port";
import { DomainException } from "../common/errors/domain-error";

describe("CompetitionsService", () => {
  let service: CompetitionsService;
  let prisma: {
    competition: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    competitionParticipant: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    creatorProfile: { findUniqueOrThrow: jest.Mock };
  };
  let cache: { buildKey: jest.Mock; get: jest.Mock; set: jest.Mock };
  let audit: { record: jest.Mock };
  let events: { emitAsync: jest.Mock };
  let instagramViews: { fetchViewCount: jest.Mock };

  const base = {
    id: "comp1",
    name: "Yozgi musobaqa",
    description: null,
    startAt: new Date("2026-08-01T00:00:00Z"),
    endAt: new Date("2026-08-31T00:00:00Z"),
    status: "DRAFT" as const,
    metric: "ORDER_COUNT" as const,
    firstPrize: "iPhone 15 Pro",
    secondPrize: "AirPods Pro",
    thirdPrize: "500,000 so'm",
    imageUrl: null,
    archivedAt: null,
    createdById: null,
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      competition: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      competitionParticipant: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      creatorProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ displayName: "Creator" }) },
    };
    cache = { buildKey: jest.fn().mockReturnValue("comp-key"), get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    events = { emitAsync: jest.fn().mockResolvedValue(undefined) };
    instagramViews = { fetchViewCount: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CompetitionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnalyticsCacheService, useValue: cache },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
        { provide: INSTAGRAM_VIEWS_PORT, useValue: instagramViews },
      ],
    }).compile();
    service = moduleRef.get(CompetitionsService);
  });

  describe("computeAvailability", () => {
    const now = new Date("2026-08-15T00:00:00Z");

    it("is INACTIVE when status isn't ACTIVE, regardless of dates", () => {
      expect(service.computeAvailability({ status: "DRAFT", startAt: base.startAt, endAt: base.endAt }, now)).toBe("INACTIVE");
    });

    it("is SCHEDULED when startAt is in the future", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: new Date("2026-09-01"), endAt: new Date("2026-09-30") }, now)).toBe("SCHEDULED");
    });

    it("is EXPIRED when endAt is in the past", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: new Date("2026-07-01"), endAt: new Date("2026-07-31") }, now)).toBe("EXPIRED");
    });

    it("is LIVE when ACTIVE and within the date window", () => {
      expect(service.computeAvailability({ status: "ACTIVE", startAt: base.startAt, endAt: base.endAt }, now)).toBe("LIVE");
    });
  });

  describe("create", () => {
    it("rejects startAt >= endAt", async () => {
      await expect(service.create({ 
        name: "x", 
        metric: "ORDER_COUNT",
        firstPrize: "iPhone",
        secondPrize: "AirPods",
        thirdPrize: "100,000 so'm",
        startAt: "2026-08-31T00:00:00Z", 
        endAt: "2026-08-01T00:00:00Z" 
      }, null)).rejects.toThrow(DomainException);
    });

    it("creates with DRAFT status by default (via the model default, not passed explicitly)", async () => {
      prisma.competition.findUnique.mockResolvedValue(null);
      prisma.competition.create.mockResolvedValue(base);
      await service.create({ 
        name: "Yozgi musobaqa", 
        metric: "ORDER_COUNT",
        firstPrize: "iPhone",
        secondPrize: "AirPods",
        thirdPrize: "100,000 so'm",
        startAt: "2026-08-01T00:00:00Z", 
        endAt: "2026-08-31T00:00:00Z" 
      }, "user1");
      expect(prisma.competition.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });
  });

  describe("transitions (publish/complete/archive)", () => {
    it("allows DRAFT -> ACTIVE via publish", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      prisma.competition.update.mockResolvedValue({ ...base, status: "ACTIVE" });
      const result = await service.publish("comp1", "user1");
      expect(result.status).toBe("ACTIVE");
    });

    it("rejects DRAFT -> COMPLETED (must go through ACTIVE first)", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      await expect(service.complete("comp1", "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });

    it("rejects any transition out of ARCHIVED", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await expect(service.publish("comp1", "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });

    it("sets archivedAt when transitioning to ARCHIVED", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ACTIVE" });
      prisma.competition.update.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await service.archive("comp1", "user1");
      expect(prisma.competition.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) }));
    });
  });

  describe("update", () => {
    it("rejects editing an ARCHIVED competition", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ARCHIVED" });
      await expect(service.update("comp1", { name: "new name" }, "user1")).rejects.toMatchObject({ code: "INVALID_COMPETITION_TRANSITION" });
    });
  });

  describe("listActiveForCreators", () => {
    it("only returns ACTIVE-status competitions whose computed availability is LIVE or SCHEDULED", async () => {
      const now = Date.now();
      prisma.competition.findMany.mockResolvedValue([
        { ...base, id: "live", status: "ACTIVE", startAt: new Date(now - 1000), endAt: new Date(now + 1_000_000) },
        { ...base, id: "scheduled", status: "ACTIVE", startAt: new Date(now + 1_000_000), endAt: new Date(now + 2_000_000) },
        { ...base, id: "expired", status: "ACTIVE", startAt: new Date(now - 2_000_000), endAt: new Date(now - 1_000_000) },
      ]);
      const result = await service.listActiveForCreators();
      expect(result.map((c) => c.id)).toEqual(["live", "scheduled"]);
      // the query itself is already scoped to status: ACTIVE — DRAFT/ARCHIVED are never fetched
      expect(prisma.competition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" } }));
    });
  });

  describe("getLeaderboard", () => {
    it("404s when the competition doesn't exist", async () => {
      prisma.competition.findUnique.mockResolvedValue(null);
      await expect(service.getLeaderboard("missing", "creator1")).rejects.toThrow(DomainException);
    });

    it("reuses the cached ranking on a hit and finds the requester's own rank", async () => {
      prisma.competition.findUnique.mockResolvedValue(base);
      cache.get.mockResolvedValue([{ creatorId: "creator1", displayName: "Me", commissionMinor: 1000, ordersCount: 1 }]);
      const result = await service.getLeaderboard("comp1", "creator1");
      expect(result.me).toMatchObject({ rank: 1, creatorId: "creator1" });
    });

    it("for INSTAGRAM_VIEWS, ranks only APPROVED participants by viewCount, ignoring PENDING/REJECTED", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, metric: "INSTAGRAM_VIEWS" });
      prisma.competitionParticipant.findMany.mockResolvedValue([
        { creatorId: "c1", viewCount: 500, creator: { displayName: "Top Creator" } },
        { creatorId: "c2", viewCount: 100, creator: { displayName: "Second" } },
      ]);
      const result = await service.getLeaderboard("comp1", "c2");
      expect(prisma.competitionParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { competitionId: "comp1", status: "APPROVED" } }),
      );
      expect(result.top.map((r) => r.creatorId)).toEqual(["c1", "c2"]);
      expect(result.top[0]).toMatchObject({ ordersCount: 500, rank: 1 });
    });
  });

  describe("join", () => {
    it("rejects joining an INSTAGRAM_VIEWS competition directly (must submit a video instead)", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ACTIVE", metric: "INSTAGRAM_VIEWS" });
      await expect(service.join("comp1", "creator1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(prisma.competitionParticipant.create).not.toHaveBeenCalled();
    });
  });

  describe("submitVideoEntry", () => {
    const liveInstagramComp = { ...base, status: "ACTIVE" as const, metric: "INSTAGRAM_VIEWS", startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 1_000_000) };

    it("rejects submitting a video to a non-INSTAGRAM_VIEWS competition", async () => {
      prisma.competition.findUnique.mockResolvedValue({ ...base, status: "ACTIVE" });
      await expect(service.submitVideoEntry("comp1", "creator1", "https://instagram.com/reel/x")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("creates a PENDING participant and notifies admins on a fresh submission", async () => {
      prisma.competition.findUnique.mockResolvedValue(liveInstagramComp);
      prisma.competitionParticipant.findUnique.mockResolvedValue(null);
      prisma.competitionParticipant.create.mockResolvedValue({ id: "p1", status: "PENDING", videoUrl: "https://instagram.com/reel/x" });

      const result = await service.submitVideoEntry("comp1", "creator1", "https://instagram.com/reel/x");

      expect(prisma.competitionParticipant.create).toHaveBeenCalledWith({
        data: { competitionId: "comp1", creatorId: "creator1", videoUrl: "https://instagram.com/reel/x", status: "PENDING" },
      });
      expect(events.emitAsync).toHaveBeenCalledWith("competition_submission.new", expect.objectContaining({ participantId: "p1", creatorId: "creator1" }));
      expect(result).toEqual({ status: "PENDING", videoUrl: "https://instagram.com/reel/x", reviewNote: undefined });
    });

    it("rejects a second submission while one is PENDING or APPROVED", async () => {
      prisma.competition.findUnique.mockResolvedValue(liveInstagramComp);
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "PENDING" });
      await expect(service.submitVideoEntry("comp1", "creator1", "https://instagram.com/reel/y")).rejects.toMatchObject({ code: "ALREADY_APPLIED" });
      expect(prisma.competitionParticipant.update).not.toHaveBeenCalled();
    });

    it("lets a REJECTED participant resubmit by updating the same row, clearing the old review", async () => {
      prisma.competition.findUnique.mockResolvedValue(liveInstagramComp);
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "REJECTED", reviewNote: "blurry video" });
      prisma.competitionParticipant.update.mockResolvedValue({ id: "p1", status: "PENDING", videoUrl: "https://instagram.com/reel/fixed", reviewNote: null });

      await service.submitVideoEntry("comp1", "creator1", "https://instagram.com/reel/fixed");

      expect(prisma.competitionParticipant.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { videoUrl: "https://instagram.com/reel/fixed", status: "PENDING", reviewNote: null, reviewedAt: null, reviewedById: null },
      });
      expect(prisma.competitionParticipant.create).not.toHaveBeenCalled();
    });
  });

  describe("approveParticipant", () => {
    it("approves a PENDING participant, records an audit entry, and notifies the creator", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "PENDING", competitionId: "comp1", creatorId: "creator1", competition: { name: "Video musobaqasi" } });
      prisma.competitionParticipant.update.mockResolvedValue({
        id: "p1", creatorId: "creator1", status: "APPROVED", videoUrl: "url", reviewNote: null, reviewedAt: new Date(), viewCount: 0, viewCountUpdatedAt: null, joinedAt: new Date(),
        creator: { displayName: "Creator" },
      });

      const result = await service.approveParticipant("p1", "admin1");

      expect(prisma.competitionParticipant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ status: "APPROVED" }) }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "COMPETITION_SUBMISSION_APPROVED", entityId: "p1" }));
      expect(events.emitAsync).toHaveBeenCalledWith("competition_submission.approved", expect.objectContaining({ creatorId: "creator1" }));
      expect(result.status).toBe("APPROVED");
    });

    it("rejects approving a participant that isn't PENDING", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "APPROVED", competition: {} });
      await expect(service.approveParticipant("p1", "admin1")).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  describe("rejectParticipant", () => {
    it("rejects a PENDING participant with a reason, records audit, and notifies the creator", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "PENDING", competitionId: "comp1", creatorId: "creator1", competition: { name: "Video musobaqasi" } });
      prisma.competitionParticipant.update.mockResolvedValue({
        id: "p1", creatorId: "creator1", status: "REJECTED", videoUrl: "url", reviewNote: "blurry", reviewedAt: new Date(), viewCount: 0, viewCountUpdatedAt: null, joinedAt: new Date(),
        creator: { displayName: "Creator" },
      });

      const result = await service.rejectParticipant("p1", "video juda xira", "admin1");

      expect(prisma.competitionParticipant.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", reviewNote: "video juda xira" }) }));
      expect(events.emitAsync).toHaveBeenCalledWith("competition_submission.rejected", expect.objectContaining({ reason: "video juda xira", decidedAt: expect.any(String) }));
      expect(result.status).toBe("REJECTED");
    });
  });

  describe("updateViewCount", () => {
    it("updates viewCount only for an APPROVED participant", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "APPROVED", viewCount: 100, competition: {} });
      prisma.competitionParticipant.update.mockResolvedValue({
        id: "p1", creatorId: "creator1", status: "APPROVED", videoUrl: "url", reviewNote: null, reviewedAt: new Date(), viewCount: 5000, viewCountUpdatedAt: new Date(), joinedAt: new Date(),
        creator: { displayName: "Creator" },
      });

      const result = await service.updateViewCount("p1", 5000, "admin1");

      expect(prisma.competitionParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ viewCount: 5000, viewCountSource: "MANUAL" }) }),
      );
      expect(result.viewCount).toBe(5000);
    });

    it("rejects updating viewCount for a non-APPROVED participant", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "PENDING", competition: {} });
      await expect(service.updateViewCount("p1", 5000, "admin1")).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  describe("refreshViewCount", () => {
    it("fetches and saves the view count with source AUTO on success", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "APPROVED", videoUrl: "https://instagram.com/reel/x", viewCount: 100, competition: {} });
      instagramViews.fetchViewCount.mockResolvedValue({ ok: true, viewCount: 9999 });
      prisma.competitionParticipant.update.mockResolvedValue({
        id: "p1", creatorId: "creator1", status: "APPROVED", videoUrl: "https://instagram.com/reel/x", reviewNote: null, reviewedAt: null,
        viewCount: 9999, viewCountUpdatedAt: new Date(), viewCountSource: "AUTO", joinedAt: new Date(), creator: { displayName: "Creator" },
      });

      const result = await service.refreshViewCount("p1", "admin1");

      expect(instagramViews.fetchViewCount).toHaveBeenCalledWith("https://instagram.com/reel/x");
      expect(prisma.competitionParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ viewCount: 9999, viewCountSource: "AUTO" }) }),
      );
      expect(result.viewCount).toBe(9999);
      expect(result.viewCountSource).toBe("AUTO");
    });

    it("throws INSTAGRAM_FETCH_FAILED without touching the stored count when the fetch fails", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "APPROVED", videoUrl: "https://instagram.com/reel/x", viewCount: 100, competition: {} });
      instagramViews.fetchViewCount.mockResolvedValue({ ok: false, errorMessage: "blocked" });

      await expect(service.refreshViewCount("p1", "admin1")).rejects.toMatchObject({ code: "INSTAGRAM_FETCH_FAILED" });
      expect(prisma.competitionParticipant.update).not.toHaveBeenCalled();
    });

    it("rejects refreshing a non-APPROVED participant", async () => {
      prisma.competitionParticipant.findUnique.mockResolvedValue({ id: "p1", status: "PENDING", videoUrl: "https://instagram.com/reel/x", competition: {} });
      await expect(service.refreshViewCount("p1", "admin1")).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect(instagramViews.fetchViewCount).not.toHaveBeenCalled();
    });
  });
});
