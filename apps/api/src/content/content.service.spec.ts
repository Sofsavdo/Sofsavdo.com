import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ContentService } from "./content.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT } from "../storage/storage.port";

jest.mock("./content-validation", () => {
  const actual: object = jest.requireActual("./content-validation");
  return {
    ...actual,
    validateAndExtractAttachment: jest.fn().mockReturnValue({ attachmentType: "IMAGE", width: 1080, height: 1440 }),
  };
});

describe("ContentService", () => {
  let service: ContentService;
  let prisma: {
    campaignApplication: { findUnique: jest.Mock };
    campaign: { findUniqueOrThrow: jest.Mock };
    content: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; updateMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock };
    contentAttachment: { create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
    contentVersion: { create: jest.Mock };
    contentReviewComment: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let campaigns: { computeAvailability: jest.Mock };
  let referrals: { onContentApproved: jest.Mock };
  let audit: { record: jest.Mock };
  let storage: { put: jest.Mock; remove: jest.Mock; publicUrl: jest.Mock };

  const baseCampaign = { id: "camp1", status: "ACTIVE" as const, startDate: null, endDate: null, contentDeadline: null as Date | null, name: "Campaign", slug: "campaign", category: "beauty", requiredContentCount: null };

  const withRelations = (over: Record<string, unknown>) => ({
    id: "content1",
    campaignId: "camp1",
    creatorId: "creator1",
    campaignApplicationId: "app1",
    status: "DRAFT",
    caption: null,
    notes: null,
    hashtags: [] as string[],
    metadata: null,
    postUrl: null as string | null,
    currentVersionNumber: 0,
    rejectionReason: null,
    changesRequestedReason: null,
    submittedAt: null,
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    expiredAt: null,
    reviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: "creator1", displayName: "Test Creator", city: null },
    campaign: { id: "camp1", name: "Campaign", slug: "campaign", category: "beauty", contentDeadline: null, requiredContentCount: null },
    attachments: [] as { id: string; role: string; attachmentType: string; storageKey: string; publicUrl: string; thumbnailUrl: null; width: number | null; height: number | null; durationSeconds: number | null; sortOrder: number }[],
    versions: [] as unknown[],
    comments: [] as unknown[],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      campaignApplication: { findUnique: jest.fn() },
      campaign: { findUniqueOrThrow: jest.fn() },
      content: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      contentAttachment: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      contentVersion: { create: jest.fn() },
      contentReviewComment: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: typeof prisma) => unknown)(prisma);
    });

    campaigns = { computeAvailability: jest.fn().mockReturnValue("LIVE") };
    referrals = { onContentApproved: jest.fn() };
    audit = { record: jest.fn() };
    storage = { put: jest.fn().mockResolvedValue({ storageKey: "content/content1/x.png", publicUrl: "http://x/content1/x.png" }), remove: jest.fn(), publicUrl: jest.fn() };

    const configService = {
      get: jest.fn().mockReturnValue({
        maxAttachmentImageBytes: 5_000_000,
        maxAttachmentVideoBytes: 100_000_000,
        maxAttachmentVideoDurationSeconds: 300,
        maxAttachmentsPerContent: 3,
        thumbnailStandardWidth: 1080,
        thumbnailStandardHeight: 1440,
        thumbnailAspectRatioTolerance: 0.02,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: CampaignsService, useValue: campaigns },
        { provide: ReferralsService, useValue: referrals },
        { provide: AuditService, useValue: audit },
        { provide: STORAGE_PORT, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(ContentService);

    prisma.campaign.findUniqueOrThrow.mockResolvedValue(baseCampaign);
  });

  describe("create — eligibility gate", () => {
    it("throws CONTENT_NOT_ELIGIBLE when no CampaignApplication exists for this campaign/creator", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue(null);
      await expect(service.create("camp1", "creator1", "user1", {})).rejects.toMatchObject({
        code: "CONTENT_NOT_ELIGIBLE",
        details: { reason: "APPLICATION_NOT_APPROVED" },
      });
    });

    it("throws CONTENT_NOT_ELIGIBLE when the CampaignApplication exists but isn't APPROVED", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ id: "app1", status: "SUBMITTED" });
      await expect(service.create("camp1", "creator1", "user1", {})).rejects.toMatchObject({ code: "CONTENT_NOT_ELIGIBLE" });
    });

    it("throws CONTENT_DEADLINE_PASSED when the campaign is EXPIRED", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ id: "app1", status: "APPROVED" });
      campaigns.computeAvailability.mockReturnValue("EXPIRED");
      await expect(service.create("camp1", "creator1", "user1", {})).rejects.toMatchObject({ code: "CONTENT_DEADLINE_PASSED" });
    });

    it("throws CONTENT_DEADLINE_PASSED when contentDeadline has already passed", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ id: "app1", status: "APPROVED" });
      prisma.campaign.findUniqueOrThrow.mockResolvedValue({ ...baseCampaign, contentDeadline: new Date("2000-01-01") });
      await expect(service.create("camp1", "creator1", "user1", {})).rejects.toMatchObject({ code: "CONTENT_DEADLINE_PASSED" });
    });

    it("creates a DRAFT Content and records an audit CREATED entry", async () => {
      prisma.campaignApplication.findUnique.mockResolvedValue({ id: "app1", status: "APPROVED" });
      prisma.content.create.mockResolvedValue({ id: "content1" });
      prisma.content.findUnique.mockResolvedValue(withRelations({}));
      const result = await service.create("camp1", "creator1", "user1", { caption: "hi" });
      expect(result.status).toBe("DRAFT");
      expect(prisma.content.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ campaignId: "camp1", creatorId: "creator1", campaignApplicationId: "app1", status: "DRAFT" }) }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATED", entityId: "content1" }));
    });
  });

  describe("ownership", () => {
    it("findMineOrThrow 404s (CONTENT_NOT_FOUND) when the content belongs to a different creator", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ creatorId: "someone-else" }));
      await expect(service.findMineOrThrow("content1", "creator1")).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" });
    });

    it("findMineOrThrow 404s for a nonexistent id", async () => {
      prisma.content.findUnique.mockResolvedValue(null);
      await expect(service.findMineOrThrow("missing", "creator1")).rejects.toMatchObject({ code: "CONTENT_NOT_FOUND" });
    });
  });

  describe("updateDraft", () => {
    it.each(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"])("blocks editing from %s", async (status) => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status }));
      await expect(service.updateDraft("content1", "creator1", "user1", { caption: "x" })).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
      expect(prisma.content.update).not.toHaveBeenCalled();
    });

    it.each(["DRAFT", "CHANGES_REQUESTED"])("allows editing from %s and records an audit EDITED entry", async (status) => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status }));
      prisma.content.update.mockResolvedValue({});
      await service.updateDraft("content1", "creator1", "user1", { caption: "updated" });
      expect(prisma.content.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ caption: "updated" }) }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "EDITED" }));
    });
  });

  describe("attachments", () => {
    it("rejects uploading a second THUMBNAIL with THUMBNAIL_ALREADY_EXISTS", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ attachments: [{ id: "a1", role: "THUMBNAIL" }] }));
      const file = { buffer: Buffer.from("x"), originalname: "t.png", mimetype: "image/png", size: 1 };
      await expect(service.uploadAttachment("content1", "creator1", "user1", { role: "THUMBNAIL" } as never, file)).rejects.toMatchObject({
        code: "THUMBNAIL_ALREADY_EXISTS",
      });
    });

    it("rejects exceeding maxAttachmentsPerContent", async () => {
      prisma.content.findUnique.mockResolvedValue(
        withRelations({ attachments: [{ id: "a1", role: "ATTACHMENT" }, { id: "a2", role: "ATTACHMENT" }, { id: "a3", role: "ATTACHMENT" }] }),
      );
      const file = { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png", size: 1 };
      await expect(service.uploadAttachment("content1", "creator1", "user1", { role: "ATTACHMENT" } as never, file)).rejects.toMatchObject({
        code: "TOO_MANY_ATTACHMENTS",
      });
    });

    it("blocks uploading while not editable (e.g. SUBMITTED)", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "SUBMITTED" }));
      const file = { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png", size: 1 };
      await expect(service.uploadAttachment("content1", "creator1", "user1", { role: "ATTACHMENT" } as never, file)).rejects.toMatchObject({
        code: "INVALID_CONTENT_TRANSITION",
      });
    });

    it("uploads successfully and records an audit ATTACHMENT_UPLOADED entry", async () => {
      prisma.content.findUnique.mockResolvedValueOnce(withRelations({})).mockResolvedValue(withRelations({}));
      prisma.contentAttachment.create.mockResolvedValue({ id: "att1", role: "ATTACHMENT", attachmentType: "IMAGE" });
      const file = { buffer: Buffer.from("x"), originalname: "a.png", mimetype: "image/png", size: 1 };
      await service.uploadAttachment("content1", "creator1", "user1", { role: "ATTACHMENT" } as never, file);
      expect(storage.put).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ATTACHMENT_UPLOADED" }));
    });

    it("removeAttachment 404s when the attachment belongs to another creator's content", async () => {
      prisma.contentAttachment.findUnique.mockResolvedValue({ id: "att1", storageKey: "k", role: "ATTACHMENT", contentId: "content1", content: { creatorId: "someone-else", status: "DRAFT" } });
      await expect(service.removeAttachment("att1", "creator1", "user1")).rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND" });
    });

    it("removeAttachment blocks removal once no longer editable", async () => {
      prisma.contentAttachment.findUnique.mockResolvedValue({ id: "att1", storageKey: "k", role: "ATTACHMENT", contentId: "content1", content: { creatorId: "creator1", status: "UNDER_REVIEW" } });
      await expect(service.removeAttachment("att1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });
  });

  describe("submit", () => {
    it("throws INVALID_CONTENT_TRANSITION unless DRAFT", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "SUBMITTED" }));
      await expect(service.submit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });

    it("throws ATTACHMENT_REQUIRED when there are zero ATTACHMENT-role attachments", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "DRAFT", attachments: [] }));
      await expect(service.submit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "ATTACHMENT_REQUIRED" });
    });

    it("a THUMBNAIL alone does not satisfy the required-attachment check", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "DRAFT", attachments: [{ id: "a1", role: "THUMBNAIL" }] }));
      await expect(service.submit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "ATTACHMENT_REQUIRED" });
    });

    it("throws POST_URL_REQUIRED when postUrl is missing, even with an attachment present", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "DRAFT", attachments: [{ id: "a1", role: "ATTACHMENT" }], postUrl: null }));
      await expect(service.submit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "POST_URL_REQUIRED" });
    });

    it("throws CONTENT_DEADLINE_PASSED when the deadline has passed at submit time", async () => {
      prisma.content.findUnique.mockResolvedValueOnce(
        withRelations({ status: "DRAFT", attachments: [{ id: "a1", role: "ATTACHMENT" }], postUrl: "https://instagram.com/p/abc" }),
      );
      prisma.campaign.findUniqueOrThrow.mockResolvedValue({ ...baseCampaign, contentDeadline: new Date("2000-01-01") });
      await expect(service.submit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "CONTENT_DEADLINE_PASSED" });
    });

    it("creates version 1, sets SUBMITTED, and records an audit SUBMITTED entry", async () => {
      prisma.content.findUnique
        .mockResolvedValueOnce(
          withRelations({
            status: "DRAFT",
            attachments: [{ id: "a1", role: "ATTACHMENT", attachmentType: "IMAGE", publicUrl: "u", width: 1, height: 1, durationSeconds: null }],
            postUrl: "https://instagram.com/p/abc",
          }),
        )
        .mockResolvedValue(withRelations({ status: "SUBMITTED", currentVersionNumber: 1 }));
      await service.submit("content1", "creator1", "user1");
      expect(prisma.contentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1, submittedById: "user1", postUrl: "https://instagram.com/p/abc" }) }),
      );
      expect(prisma.content.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SUBMITTED", currentVersionNumber: 1 }) }),
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "SUBMITTED" }));
    });
  });

  describe("resubmit", () => {
    it("throws INVALID_CONTENT_TRANSITION unless CHANGES_REQUESTED", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "DRAFT" }));
      await expect(service.resubmit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });

    it("throws POST_URL_REQUIRED on resubmit too, not just first submit", async () => {
      prisma.content.findUnique.mockResolvedValue(
        withRelations({ status: "CHANGES_REQUESTED", attachments: [{ id: "a1", role: "ATTACHMENT" }], postUrl: null }),
      );
      await expect(service.resubmit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "POST_URL_REQUIRED" });
    });

    it("increments the version number on resubmit", async () => {
      prisma.content.findUnique
        .mockResolvedValueOnce(
          withRelations({
            status: "CHANGES_REQUESTED",
            currentVersionNumber: 1,
            attachments: [{ id: "a1", role: "ATTACHMENT", attachmentType: "IMAGE", publicUrl: "u", width: 1, height: 1, durationSeconds: null }],
            postUrl: "https://instagram.com/p/abc",
          }),
        )
        .mockResolvedValue(withRelations({ status: "SUBMITTED", currentVersionNumber: 2 }));
      await service.resubmit("content1", "creator1", "user1");
      expect(prisma.contentVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionNumber: 2 }) }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "RESUBMITTED" }));
    });
  });

  describe("expireStaleContent (lazy expiration sweep)", () => {
    it("flips stale non-terminal content to EXPIRED before listing, with an audit trail entry", async () => {
      prisma.content.findMany
        .mockResolvedValueOnce([{ id: "c1", status: "DRAFT" }]) // expireStaleContent's own stale-detection query
        .mockResolvedValueOnce([]); // listMine's real query afterward
      prisma.content.updateMany.mockResolvedValue({ count: 1 });
      await service.listMine("creator1");
      expect(prisma.content.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["c1"] } }, data: { status: "EXPIRED", expiredAt: expect.any(Date) } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPIRED", entityId: "c1", before: { status: "DRAFT" } }));
    });

    it("does nothing when nothing is stale", async () => {
      prisma.content.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await service.listMine("creator1");
      expect(prisma.content.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("admin — startReview / reject / requestChanges", () => {
    it("startReview throws INVALID_CONTENT_TRANSITION unless SUBMITTED", async () => {
      prisma.content.findUnique.mockResolvedValue({ id: "content1", status: "DRAFT" });
      await expect(service.startReview("content1", "admin1")).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });

    it("startReview moves SUBMITTED -> UNDER_REVIEW and records the reviewer", async () => {
      prisma.content.findUnique.mockResolvedValueOnce({ id: "content1", status: "SUBMITTED" }).mockResolvedValue(withRelations({ status: "UNDER_REVIEW" }));
      await service.startReview("content1", "admin1");
      expect(prisma.content.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "UNDER_REVIEW", reviewedById: "admin1" }) }));
    });

    it("reject requires UNDER_REVIEW and is terminal — writes rejectionReason + a ContentReviewComment", async () => {
      prisma.content.findUnique.mockResolvedValueOnce({ id: "content1", status: "UNDER_REVIEW", currentVersionNumber: 1 }).mockResolvedValue(withRelations({ status: "REJECTED" }));
      await service.reject("content1", "admin1", "Does not follow brief");
      expect(prisma.content.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", rejectionReason: "Does not follow brief" }) }),
      );
      expect(prisma.contentReviewComment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "REJECTED", comment: "Does not follow brief" }) }),
      );
      expect(referrals.onContentApproved).not.toHaveBeenCalled();
    });

    it("rejected content cannot be resubmitted — REJECTED is not in RESUBMIT_FROM", async () => {
      prisma.content.findUnique.mockResolvedValue(withRelations({ status: "REJECTED" }));
      await expect(service.resubmit("content1", "creator1", "user1")).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });

    it("requestChanges requires UNDER_REVIEW and writes changesRequestedReason + a ContentReviewComment", async () => {
      prisma.content.findUnique.mockResolvedValueOnce({ id: "content1", status: "UNDER_REVIEW", currentVersionNumber: 1 }).mockResolvedValue(withRelations({ status: "CHANGES_REQUESTED" }));
      await service.requestChanges("content1", "admin1", "Please retake with better lighting");
      expect(prisma.content.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "CHANGES_REQUESTED", changesRequestedReason: "Please retake with better lighting" }) }),
      );
      expect(prisma.contentReviewComment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "CHANGES_REQUESTED" }) }),
      );
    });
  });

  describe("admin — approve", () => {
    it("throws INVALID_CONTENT_TRANSITION unless UNDER_REVIEW", async () => {
      prisma.content.findUnique.mockResolvedValue({ id: "content1", status: "SUBMITTED" });
      await expect(service.approve("content1", "admin1", undefined)).rejects.toMatchObject({ code: "INVALID_CONTENT_TRANSITION" });
    });

    it("approves, becomes immutable (no further edit path exercised), fires the referral hook, and writes a comment", async () => {
      prisma.content.findUnique
        .mockResolvedValueOnce({ id: "content1", status: "UNDER_REVIEW", currentVersionNumber: 1, creatorId: "creator1" })
        .mockResolvedValue(withRelations({ status: "APPROVED" }));
      await service.approve("content1", "admin1", "Great work!");
      expect(prisma.content.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }));
      expect(prisma.contentReviewComment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "APPROVED", comment: "Great work!" }) }));
      expect(referrals.onContentApproved).toHaveBeenCalledWith("creator1", "content1");
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "APPROVED" }));
    });

    it("defaults the review comment to a non-empty string when none is given (comment column is NOT NULL)", async () => {
      prisma.content.findUnique
        .mockResolvedValueOnce({ id: "content1", status: "UNDER_REVIEW", currentVersionNumber: 1, creatorId: "creator1" })
        .mockResolvedValue(withRelations({ status: "APPROVED" }));
      await service.approve("content1", "admin1", undefined);
      const call = prisma.contentReviewComment.create.mock.calls[0][0];
      expect(typeof call.data.comment).toBe("string");
      expect(call.data.comment.length).toBeGreaterThan(0);
    });
  });

  describe("admin — list", () => {
    beforeEach(() => {
      prisma.content.findMany.mockResolvedValue([]);
      prisma.content.count.mockResolvedValue(0);
    });

    it("filters by status/campaignId/creatorId", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, status: "SUBMITTED", campaignId: "camp1", creatorId: "creator1" });
      const calls = prisma.content.findMany.mock.calls;
      const listCall = calls[calls.length - 1][0];
      expect(listCall.where).toMatchObject({ status: "SUBMITTED", campaignId: "camp1", creatorId: "creator1" });
    });

    it("defaults sort to createdAt desc and rejects a non-whitelisted sortBy", async () => {
      await service.list({ page: 1, pageSize: 20, skip: 0, take: 20, sortBy: "caption" });
      const calls = prisma.content.findMany.mock.calls;
      const listCall = calls[calls.length - 1][0];
      expect(listCall.orderBy).toEqual({ createdAt: "desc" });
    });
  });

  describe("creator-safe response mapping", () => {
    it("never includes reviewedById or attachment storageKey/mimeType", async () => {
      prisma.content.findUnique.mockResolvedValue(
        withRelations({
          reviewedById: "admin-user-1",
          attachments: [{ id: "a1", role: "ATTACHMENT", attachmentType: "IMAGE", storageKey: "secret/key.png", publicUrl: "http://x/a.png", thumbnailUrl: null, mimeType: "image/png", fileSizeBytes: 123, originalFilename: "orig.png", width: 10, height: 10, durationSeconds: null, sortOrder: 0 }],
        }),
      );
      const result = await service.findMineOrThrow("content1", "creator1");
      expect(result).not.toHaveProperty("reviewedById");
      expect(JSON.stringify(result)).not.toContain("secret/key.png");
      expect(JSON.stringify(result)).not.toContain("orig.png");
    });
  });
});
