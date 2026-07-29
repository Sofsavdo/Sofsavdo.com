import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type Campaign, type Content, type ContentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import { validateAndExtractAttachment, normalizeFilename, type ContentValidationConfig } from "./content-validation";
import type { CreateContentDto } from "./dto/create-content.dto";
import type { UploadAttachmentDto } from "./dto/upload-attachment.dto";
import type { ContentQueryDto } from "./dto/content-query.dto";

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const CREATOR_SUMMARY_SELECT = { id: true, displayName: true, city: true } satisfies Prisma.CreatorProfileSelect;
const CAMPAIGN_SUMMARY_SELECT = { id: true, name: true, slug: true, category: true, contentDeadline: true, requiredContentCount: true } satisfies Prisma.CampaignSelect;

const CONTENT_INCLUDE = {
  creator: { select: CREATOR_SUMMARY_SELECT },
  campaign: { select: CAMPAIGN_SUMMARY_SELECT },
  attachments: { orderBy: { sortOrder: "asc" } },
  versions: { orderBy: { versionNumber: "asc" } },
  comments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.ContentInclude;

type ContentWithRelations = Prisma.ContentGetPayload<{ include: typeof CONTENT_INCLUDE }>;

export interface AttachmentResponse {
  id: string;
  attachmentType: string;
  role: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sortOrder: number;
}

export type AttachmentAdminResponse = ContentWithRelations["attachments"][number];

export interface VersionResponse {
  id: string;
  versionNumber: number;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: Prisma.JsonValue;
  postUrl: string | null;
  attachmentSnapshot: Prisma.JsonValue;
  submittedAt: Date;
}

// Creator-safe — never exposes reviewer/author identity, matching the CampaignApplication
// convention of hiding adminNotes/reviewedById from the creator-facing shape.
export interface ContentCommentCreatorResponse {
  id: string;
  versionNumber: number;
  action: string;
  comment: string;
  createdAt: Date;
}

export interface ContentCommentAdminResponse extends ContentCommentCreatorResponse {
  authorId: string;
}

export interface ContentCreatorResponse {
  id: string;
  campaignId: string;
  campaignApplicationId: string;
  status: ContentStatus;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: Prisma.JsonValue;
  postUrl: string | null;
  currentVersionNumber: number;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  campaign: { id: string; name: string; slug: string; category: string; contentDeadline: Date | null; requiredContentCount: number | null };
  attachments: AttachmentResponse[];
  versions: VersionResponse[];
  comments: ContentCommentCreatorResponse[];
}

export interface ContentAdminResponse extends Omit<ContentCreatorResponse, "attachments" | "comments"> {
  reviewedById: string | null;
  creator: { id: string; displayName: string; city: string | null };
  attachments: AttachmentAdminResponse[];
  comments: ContentCommentAdminResponse[];
}

// Explicit per-action allowed source-states — same convention as CreatorApplicationsService
// (see DECISIONS.md ADR-012/ADR-014): submit/resubmit both land on different downstream states
// from different sources and are distinct creator actions, not one generic transition matrix.
const EDIT_FROM: ContentStatus[] = ["DRAFT", "CHANGES_REQUESTED"];
const SUBMIT_FROM: ContentStatus[] = ["DRAFT"];
const RESUBMIT_FROM: ContentStatus[] = ["CHANGES_REQUESTED"];
const START_REVIEW_FROM: ContentStatus[] = ["SUBMITTED"];
const DECIDE_FROM: ContentStatus[] = ["UNDER_REVIEW"];
const NON_TERMINAL: ContentStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"];

@Injectable()
export class ContentService {
  private readonly contentConfig: ContentValidationConfig;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private campaigns: CampaignsService,
    private referrals: ReferralsService,
    private audit: AuditService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {
    this.contentConfig = this.config.get<ContentValidationConfig>("content")!;
  }

  // ---- Response mapping ----

  private toAttachmentResponse(a: ContentWithRelations["attachments"][number]): AttachmentResponse {
    return {
      id: a.id,
      attachmentType: a.attachmentType,
      role: a.role,
      url: a.publicUrl,
      thumbnailUrl: a.thumbnailUrl,
      width: a.width,
      height: a.height,
      durationSeconds: a.durationSeconds,
      sortOrder: a.sortOrder,
    };
  }

  private toVersionResponse(v: ContentWithRelations["versions"][number]): VersionResponse {
    return {
      id: v.id,
      versionNumber: v.versionNumber,
      caption: v.caption,
      notes: v.notes,
      hashtags: v.hashtags,
      metadata: v.metadata,
      postUrl: v.postUrl,
      attachmentSnapshot: v.attachmentSnapshot,
      submittedAt: v.submittedAt,
    };
  }

  private toCreatorResponse(c: ContentWithRelations): ContentCreatorResponse {
    return {
      id: c.id,
      campaignId: c.campaignId,
      campaignApplicationId: c.campaignApplicationId,
      status: c.status,
      caption: c.caption,
      notes: c.notes,
      hashtags: c.hashtags,
      metadata: c.metadata,
      postUrl: c.postUrl,
      currentVersionNumber: c.currentVersionNumber,
      rejectionReason: c.rejectionReason,
      changesRequestedReason: c.changesRequestedReason,
      submittedAt: c.submittedAt,
      reviewedAt: c.reviewedAt,
      approvedAt: c.approvedAt,
      rejectedAt: c.rejectedAt,
      expiredAt: c.expiredAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      campaign: c.campaign,
      attachments: c.attachments.map((a) => this.toAttachmentResponse(a)),
      versions: c.versions.map((v) => this.toVersionResponse(v)),
      comments: c.comments.map((cm) => ({ id: cm.id, versionNumber: cm.versionNumber, action: cm.action, comment: cm.comment, createdAt: cm.createdAt })),
    };
  }

  private toAdminResponse(c: ContentWithRelations): ContentAdminResponse {
    return {
      ...this.toCreatorResponse(c),
      reviewedById: c.reviewedById,
      creator: c.creator,
      attachments: c.attachments,
      comments: c.comments.map((cm) => ({ id: cm.id, versionNumber: cm.versionNumber, action: cm.action, comment: cm.comment, createdAt: cm.createdAt, authorId: cm.authorId })),
    };
  }

  // ---- Deadline enforcement (spec §Deadlines) ----

  private assertCampaignAcceptsNewContent(campaign: Pick<Campaign, "status" | "startDate" | "endDate" | "contentDeadline">, now = new Date()): void {
    if (this.campaigns.computeAvailability(campaign, now) === "EXPIRED") {
      throw new DomainException("CONTENT_DEADLINE_PASSED", "Kampaniya muddati tugagan — yangi content qabul qilinmaydi.");
    }
    if (campaign.contentDeadline && campaign.contentDeadline < now) {
      throw new DomainException("CONTENT_DEADLINE_PASSED", "Content topshirish muddati tugagan.");
    }
  }

  // Lazy expiration sweep — this codebase has no scheduler/queue infrastructure (see
  // DECISIONS.md ADR-014), so EXPIRED is materialized the next time stale rows are read/mutated
  // rather than by a background job. Runs before every read/mutation entry point below.
  private async expireStaleContent(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.content.findMany({
      where: {
        status: { in: NON_TERMINAL },
        OR: [{ campaign: { contentDeadline: { lt: now } } }, { campaign: { status: "ACTIVE", endDate: { lt: now } } }],
      },
      select: { id: true, status: true },
    });
    if (stale.length === 0) return;
    await this.prisma.content.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "EXPIRED", expiredAt: now } });
    for (const s of stale) {
      await this.audit.record({ actorId: null, action: "EXPIRED", entityType: "Content", entityId: s.id, before: { status: s.status }, after: { status: "EXPIRED" } });
    }
  }

  // ---- Creator-facing ----

  async create(campaignId: string, creatorId: string, userId: string, dto: CreateContentDto): Promise<ContentCreatorResponse> {
    const application = await this.prisma.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId } } });
    if (!application || application.status !== "APPROVED") {
      throw new DomainException("CONTENT_NOT_ELIGIBLE", "Content yaratish uchun ushbu kampaniyaga tasdiqlangan arizangiz bo'lishi kerak.", {
        reason: "APPLICATION_NOT_APPROVED",
      });
    }
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    this.assertCampaignAcceptsNewContent(campaign);

    const created = await this.prisma.content.create({
      data: {
        campaignId,
        creatorId,
        campaignApplicationId: application.id,
        status: "DRAFT",
        caption: dto.caption,
        notes: dto.notes,
        hashtags: dto.hashtags ?? [],
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.record({ actorId: userId, action: "CREATED", entityType: "Content", entityId: created.id, after: { status: "DRAFT" } });
    return this.findMineOrThrow(created.id, creatorId);
  }

  private async findOwnedOrThrow(id: string, creatorId: string): Promise<ContentWithRelations> {
    await this.expireStaleContent();
    const content = await this.prisma.content.findUnique({ where: { id }, include: CONTENT_INCLUDE });
    // Same NOT_FOUND for "doesn't exist" and "belongs to someone else" — no id-guessing oracle,
    // same pattern as CampaignApplication's findOwnedOrThrow.
    if (!content || content.creatorId !== creatorId) throw new DomainException("CONTENT_NOT_FOUND", "Content topilmadi.");
    return content;
  }

  async findMineOrThrow(id: string, creatorId: string): Promise<ContentCreatorResponse> {
    return this.toCreatorResponse(await this.findOwnedOrThrow(id, creatorId));
  }

  async listMine(creatorId: string): Promise<ContentCreatorResponse[]> {
    await this.expireStaleContent();
    const items = await this.prisma.content.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, include: CONTENT_INCLUDE });
    return items.map((c) => this.toCreatorResponse(c));
  }

  // Backend-computed dashboard counts (spec §Creator Dashboard: "Counts must come from backend").
  async getMyDashboardCounts(creatorId: string): Promise<Record<ContentStatus, number>> {
    await this.expireStaleContent();
    const grouped = await this.prisma.content.groupBy({ by: ["status"], where: { creatorId }, _count: { _all: true } });
    const counts: Record<ContentStatus, number> = { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, CHANGES_REQUESTED: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    return counts;
  }

  async updateDraft(id: string, creatorId: string, userId: string, dto: CreateContentDto): Promise<ContentCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!EDIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Bu holatdagi contentni tahrirlab bo'lmaydi.", { from: existing.status });
    }
    const before = { caption: existing.caption, notes: existing.notes, hashtags: existing.hashtags, metadata: existing.metadata, postUrl: existing.postUrl };
    await this.prisma.content.update({
      where: { id },
      data: {
        caption: dto.caption,
        notes: dto.notes,
        hashtags: dto.hashtags,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        postUrl: dto.postUrl,
      },
    });
    await this.audit.record({ actorId: userId, action: "EDITED", entityType: "Content", entityId: id, before, after: dto });
    return this.findMineOrThrow(id, creatorId);
  }

  // ---- Attachments ----

  private buildStorageKey(contentId: string, filename: string): string {
    return `content/${contentId}/${Date.now()}-${normalizeFilename(filename)}`;
  }

  async uploadAttachment(id: string, creatorId: string, userId: string, dto: UploadAttachmentDto, file: UploadedFile): Promise<ContentCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!EDIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Bu holatdagi contentga fayl qo'shib bo'lmaydi.", { from: existing.status });
    }

    if (dto.role === "THUMBNAIL") {
      const existingThumbnail = existing.attachments.find((a) => a.role === "THUMBNAIL");
      if (existingThumbnail) throw new DomainException("THUMBNAIL_ALREADY_EXISTS", "Ushbu content uchun allaqachon thumbnail mavjud.");
    } else {
      const attachmentCount = existing.attachments.filter((a) => a.role === "ATTACHMENT").length;
      if (attachmentCount >= this.contentConfig.maxAttachmentsPerContent) {
        throw new DomainException("TOO_MANY_ATTACHMENTS", "Ruxsat etilgan maksimal fayl sonidan oshib ketdi.", {
          max: this.contentConfig.maxAttachmentsPerContent,
        });
      }
    }

    const meta = validateAndExtractAttachment(file.buffer, file.mimetype, dto.role, this.contentConfig, {
      width: dto.width,
      height: dto.height,
      durationSeconds: dto.durationSeconds,
    });

    const storageKey = this.buildStorageKey(id, file.originalname);
    const stored = await this.storage.put(storageKey, file.buffer, file.mimetype);

    const created = await this.prisma.contentAttachment.create({
      data: {
        contentId: id,
        attachmentType: meta.attachmentType,
        role: dto.role,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        originalFilename: normalizeFilename(file.originalname),
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.attachmentType === "VIDEO" ? (dto.durationSeconds ?? null) : null,
        sortOrder: existing.attachments.filter((a) => a.role === "ATTACHMENT").length,
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "ATTACHMENT_UPLOADED",
      entityType: "Content",
      entityId: id,
      after: { attachmentId: created.id, role: created.role, attachmentType: created.attachmentType },
    });
    return this.findMineOrThrow(id, creatorId);
  }

  async removeAttachment(attachmentId: string, creatorId: string, userId: string): Promise<ContentCreatorResponse> {
    const attachment = await this.prisma.contentAttachment.findUnique({ where: { id: attachmentId }, include: { content: true } });
    if (!attachment || attachment.content.creatorId !== creatorId) throw new DomainException("ATTACHMENT_NOT_FOUND", "Fayl topilmadi.");
    if (!EDIT_FROM.includes(attachment.content.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Bu holatdagi contentdan faylni o'chirib bo'lmaydi.", { from: attachment.content.status });
    }
    await this.prisma.contentAttachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(attachment.storageKey);
    await this.audit.record({
      actorId: userId,
      action: "ATTACHMENT_REMOVED",
      entityType: "Content",
      entityId: attachment.contentId,
      before: { attachmentId, role: attachment.role },
    });
    return this.findMineOrThrow(attachment.contentId, creatorId);
  }

  // ---- Submit / resubmit ----

  // Re-fetches the deadline-relevant Campaign fields directly rather than reusing
  // ContentWithRelations["campaign"] (a narrower creator-safe summary select that deliberately
  // omits status/startDate/endDate) — keeps the shared CAMPAIGN_SUMMARY_SELECT free of fields
  // that would otherwise leak into creator-facing responses.
  private async assertSubmittable(content: ContentWithRelations): Promise<void> {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: content.campaignId },
      select: { status: true, startDate: true, endDate: true, contentDeadline: true },
    });
    this.assertCampaignAcceptsNewContent(campaign);
    const requiredAttachmentCount = content.attachments.filter((a) => a.role === "ATTACHMENT").length;
    if (requiredAttachmentCount === 0) {
      throw new DomainException("ATTACHMENT_REQUIRED", "Kamida bitta fayl biriktirilishi kerak.");
    }
    // Phase P — a screenshot alone isn't verifiable (old or borrowed screenshots are trivial to
    // fake); the live link is what lets an admin actually click through and confirm the post is
    // real, same as Perfluence-style contractual verification. The screenshot stays required too
    // (see above) as the permanent evidence archive independent of the link's future fate — see
    // DECISIONS.md ADR-033.
    if (!content.postUrl) {
      throw new DomainException("POST_URL_REQUIRED", "Post havolasini kiritish shart.");
    }
  }

  private async createVersionAndSubmit(content: ContentWithRelations, userId: string, auditAction: "SUBMITTED" | "RESUBMITTED"): Promise<void> {
    const nextVersion = content.currentVersionNumber + 1;
    const attachmentSnapshot = content.attachments.map((a) => ({
      id: a.id,
      attachmentType: a.attachmentType,
      role: a.role,
      url: a.publicUrl,
      width: a.width,
      height: a.height,
      durationSeconds: a.durationSeconds,
    }));
    await this.prisma.$transaction([
      this.prisma.contentVersion.create({
        data: {
          contentId: content.id,
          versionNumber: nextVersion,
          caption: content.caption,
          notes: content.notes,
          hashtags: content.hashtags,
          metadata: content.metadata as Prisma.InputJsonValue | undefined,
          postUrl: content.postUrl,
          attachmentSnapshot,
          submittedById: userId,
        },
      }),
      this.prisma.content.update({
        where: { id: content.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), currentVersionNumber: nextVersion },
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: auditAction,
      entityType: "Content",
      entityId: content.id,
      after: { versionNumber: nextVersion, status: "SUBMITTED" },
    });
  }

  async submit(id: string, creatorId: string, userId: string): Promise<ContentCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!SUBMIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat qoralama contentni yuborish mumkin.", { from: existing.status });
    }
    await this.assertSubmittable(existing);
    await this.createVersionAndSubmit(existing, userId, "SUBMITTED");
    return this.findMineOrThrow(id, creatorId);
  }

  async resubmit(id: string, creatorId: string, userId: string): Promise<ContentCreatorResponse> {
    const existing = await this.findOwnedOrThrow(id, creatorId);
    if (!RESUBMIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat o'zgartirish so'ralgan contentni qayta yuborish mumkin.", {
        from: existing.status,
      });
    }
    await this.assertSubmittable(existing);
    await this.createVersionAndSubmit(existing, userId, "RESUBMITTED");
    return this.findMineOrThrow(id, creatorId);
  }

  // ---- Admin-facing ----

  async list(query: ContentQueryDto): Promise<PaginatedResult<ContentAdminResponse>> {
    await this.expireStaleContent();
    const where: Prisma.ContentWhereInput = {
      status: query.status,
      campaignId: query.campaignId,
      creatorId: query.creatorId,
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { creator: { displayName: { contains: query.search, mode: "insensitive" } } },
              { campaign: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "submittedAt", "reviewedAt", "status"]);
    const orderBy: Prisma.ContentOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({ where, orderBy, skip: query.skip, take: query.take, include: CONTENT_INCLUDE }),
      this.prisma.content.count({ where }),
    ]);
    return paginate(items.map((c) => this.toAdminResponse(c)), total, query);
  }

  async findOneOrThrow(id: string): Promise<ContentAdminResponse> {
    await this.expireStaleContent();
    const content = await this.prisma.content.findUnique({ where: { id }, include: CONTENT_INCLUDE });
    if (!content) throw new DomainException("CONTENT_NOT_FOUND", "Content topilmadi.");
    return this.toAdminResponse(content);
  }

  private async findRawOrThrow(id: string): Promise<Content> {
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new DomainException("CONTENT_NOT_FOUND", "Content topilmadi.");
    return content;
  }

  async startReview(id: string, actorId: string): Promise<ContentAdminResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!START_REVIEW_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat yuborilgan contentni ko'rib chiqishni boshlash mumkin.", {
        from: existing.status,
      });
    }
    await this.prisma.content.update({ where: { id }, data: { status: "UNDER_REVIEW", reviewedAt: new Date(), reviewedById: actorId } });
    await this.audit.record({ actorId, action: "REVIEW_STARTED", entityType: "Content", entityId: id });
    return this.findOneOrThrow(id);
  }

  async approve(id: string, actorId: string, comment: string | undefined): Promise<ContentAdminResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat ko'rib chiqilayotgan contentni tasdiqlash mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.content.update({ where: { id }, data: { status: "APPROVED", approvedAt: now, reviewedAt: now, reviewedById: actorId } }),
      this.prisma.contentReviewComment.create({
        data: { contentId: id, versionNumber: existing.currentVersionNumber, authorId: actorId, action: "APPROVED", comment: comment?.trim() || "Tasdiqlandi." },
      }),
    ]);
    await this.audit.record({ actorId, action: "APPROVED", entityType: "Content", entityId: id });
    await this.referrals.onContentApproved(existing.creatorId, id);
    return this.findOneOrThrow(id);
  }

  async reject(id: string, actorId: string, reason: string): Promise<ContentAdminResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat ko'rib chiqilayotgan contentni rad etish mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.content.update({
        where: { id },
        data: { status: "REJECTED", rejectionReason: reason, rejectedAt: now, reviewedAt: now, reviewedById: actorId },
      }),
      this.prisma.contentReviewComment.create({
        data: { contentId: id, versionNumber: existing.currentVersionNumber, authorId: actorId, action: "REJECTED", comment: reason },
      }),
    ]);
    await this.audit.record({ actorId, action: "REJECTED", entityType: "Content", entityId: id, after: { reason } });
    return this.findOneOrThrow(id);
  }

  async requestChanges(id: string, actorId: string, reason: string): Promise<ContentAdminResponse> {
    const existing = await this.findRawOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_CONTENT_TRANSITION", "Faqat ko'rib chiqilayotgan contentdan o'zgartirish so'ralishi mumkin.", {
        from: existing.status,
      });
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.content.update({
        where: { id },
        data: { status: "CHANGES_REQUESTED", changesRequestedReason: reason, reviewedAt: now, reviewedById: actorId },
      }),
      this.prisma.contentReviewComment.create({
        data: { contentId: id, versionNumber: existing.currentVersionNumber, authorId: actorId, action: "CHANGES_REQUESTED", comment: reason },
      }),
    ]);
    await this.audit.record({ actorId, action: "CHANGES_REQUESTED", entityType: "Content", entityId: id, after: { reason } });
    return this.findOneOrThrow(id);
  }
}
