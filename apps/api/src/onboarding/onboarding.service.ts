import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, SocialPlatform, type CreatorApplication, type CreatorApplicationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { AuditService, type AuditLogEntry } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { paginate, type PaginatedResult } from "../common/pagination/pagination.dto";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import type { UpdateOnboardingDto } from "./dto/update-onboarding.dto";
import type { OnboardingQueryDto } from "./dto/onboarding-query.dto";

const CREATOR_SUMMARY_SELECT = { id: true, displayName: true, city: true, user: { select: { email: true } } } satisfies Prisma.CreatorProfileSelect;

type ApplicationWithCreator = CreatorApplication & {
  creator: { id: string; displayName: string; city: string | null; user: { email: string | null } };
};

// Creator-safe shape — mirrors CreatorProfileService.getMine's application sub-object exactly
// (same field names) so the frontend's session-cache merge (queryClient.setQueryData(["session"],
// (prev) => ({ ...prev, application }))) can treat this response as a drop-in replacement.
export interface OnboardingCreatorResponse {
  id: string;
  status: CreatorApplicationStatus;
  currentStep: number;
  data: Prisma.JsonValue;
  reviewNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export interface OnboardingAdminResponse {
  id: string;
  status: CreatorApplicationStatus;
  currentStep: number;
  formData: Prisma.JsonValue;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creator: { id: string; displayName: string; city: string | null; email: string | null };
}

// Explicit per-action allowed source-states — same "not a single generic transition(to) matrix"
// convention as creator-applications.service.ts's SUBMIT_FROM/RESUBMIT_FROM/etc.
const EDIT_FROM: CreatorApplicationStatus[] = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"];
const SUBMIT_FROM: CreatorApplicationStatus[] = ["DRAFT"];
// REJECTED is resubmittable here (unlike CampaignApplication's terminal REJECTED) — onboarding is
// a single continuous account gate, not a per-campaign one-shot decision; permanently locking out a
// rejected creator would contradict the platform's basic premise that anyone can become a creator
// once they meet the bar. See DECISIONS.md ADR-018.
const RESUBMIT_FROM: CreatorApplicationStatus[] = ["CHANGES_REQUESTED", "REJECTED"];
const START_REVIEW_FROM: CreatorApplicationStatus[] = ["SUBMITTED"];
const DECIDE_FROM: CreatorApplicationStatus[] = ["UNDER_REVIEW"];

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private referrals: ReferralsService,
    private audit: AuditService,
    private events: EventEmitter2,
  ) {}

  private toCreatorResponse(app: CreatorApplication): OnboardingCreatorResponse {
    return {
      id: app.id,
      status: app.status,
      currentStep: app.currentStep,
      data: app.formData,
      reviewNote: app.reviewNote,
      submittedAt: app.submittedAt,
      reviewedAt: app.reviewedAt,
    };
  }

  private toAdminResponse(app: ApplicationWithCreator): OnboardingAdminResponse {
    return {
      id: app.id,
      status: app.status,
      currentStep: app.currentStep,
      formData: app.formData,
      reviewNote: app.reviewNote,
      reviewedById: app.reviewedById,
      reviewedAt: app.reviewedAt,
      submittedAt: app.submittedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      creator: { id: app.creator.id, displayName: app.creator.displayName, city: app.creator.city, email: app.creator.user.email },
    };
  }

  // ---- Creator-facing ----
  // Not gated by RequireCreatorGuard — that guard requires an *approved* application, which is
  // exactly what an applicant here does not yet have. Ownership is the creatorId off the JWT, same
  // pattern as CreatorProfileController. See RBAC.md's Phase 11 note.

  private async findLatestOwnedOrThrow(creatorId: string): Promise<CreatorApplication> {
    const app = await this.prisma.creatorApplication.findFirst({ where: { creatorId }, orderBy: { createdAt: "desc" } });
    // Every real creator account has exactly one CreatorApplication row created at registration
    // (see AuthService.register) — its absence is a data-integrity problem, not a normal state.
    if (!app) throw new DomainException("NOT_FOUND", "Creator arizasi topilmadi.");
    return app;
  }

  async getMine(creatorId: string): Promise<OnboardingCreatorResponse> {
    return this.toCreatorResponse(await this.findLatestOwnedOrThrow(creatorId));
  }

  async updateDraft(creatorId: string, dto: UpdateOnboardingDto): Promise<OnboardingCreatorResponse> {
    const existing = await this.findLatestOwnedOrThrow(creatorId);
    if (!EDIT_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", "Bu holatdagi arizani tahrirlab bo'lmaydi.", { from: existing.status });
    }
    const updated = await this.prisma.creatorApplication.update({
      where: { id: existing.id },
      data: {
        currentStep: dto.currentStep ?? existing.currentStep,
        formData: dto.formData !== undefined ? (dto.formData as Prisma.InputJsonValue) : undefined,
      },
    });
    return this.toCreatorResponse(updated);
  }

  private async submitOrResubmit(
    creatorId: string,
    fromStatuses: CreatorApplicationStatus[],
    transitionErrorMessage: string,
  ): Promise<OnboardingCreatorResponse> {
    const existing = await this.findLatestOwnedOrThrow(creatorId);
    if (!fromStatuses.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", transitionErrorMessage, { from: existing.status });
    }
    const creator = await this.prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });
    const updated = await this.prisma.creatorApplication.update({
      where: { id: existing.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await this.referrals.onOnboardingSubmitted(creatorId);
    // emitAsync, not emit — see auth.service.ts's identical comment: closes the race between this
    // call returning and NotificationEventsListener's own async DB writes completing.
    await this.events.emitAsync(NOTIFICATION_EVENTS.ONBOARDING_SUBMITTED, {
      applicationId: updated.id,
      creatorId,
      creatorName: creator.displayName,
    });
    return this.toCreatorResponse(updated);
  }

  async submit(creatorId: string): Promise<OnboardingCreatorResponse> {
    return this.submitOrResubmit(creatorId, SUBMIT_FROM, "Faqat qoralama arizani yuborish mumkin.");
  }

  async resubmit(creatorId: string): Promise<OnboardingCreatorResponse> {
    return this.submitOrResubmit(
      creatorId,
      RESUBMIT_FROM,
      "Faqat o'zgartirish so'ralgan yoki rad etilgan arizani qayta yuborish mumkin.",
    );
  }

  // ---- Admin-facing ----

  async list(query: OnboardingQueryDto): Promise<PaginatedResult<OnboardingAdminResponse>> {
    const where: Prisma.CreatorApplicationWhereInput = {
      status: query.status,
      // Every real creator has a DRAFT row from registration (see AuthService.register) that is
      // never a meaningful review-queue entry until the creator has actually touched it — matching
      // the CampaignApplication admin list's `status: { not: "DRAFT" }` convention used elsewhere,
      // applied here as "only show DRAFT when explicitly filtered for it".
      ...(query.status ? {} : { status: { not: "DRAFT" } }),
      ...(query.dateFrom || query.dateTo
        ? { createdAt: { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined } }
        : {}),
      ...(query.search
        ? {
            creator: {
              OR: [{ displayName: { contains: query.search, mode: "insensitive" } }, { user: { email: { contains: query.search, mode: "insensitive" } } }],
            },
          }
        : {}),
    };

    const sortableFields = new Set(["createdAt", "submittedAt", "reviewedAt", "status"]);
    const orderBy: Prisma.CreatorApplicationOrderByWithRelationInput =
      query.sortBy && sortableFields.has(query.sortBy) ? { [query.sortBy]: query.sortDir ?? "desc" } : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.creatorApplication.findMany({ where, orderBy, skip: query.skip, take: query.take, include: { creator: { select: CREATOR_SUMMARY_SELECT } } }),
      this.prisma.creatorApplication.count({ where }),
    ]);

    return paginate(items.map((a) => this.toAdminResponse(a)), total, query);
  }

  private async findOneWithCreatorOrThrow(id: string): Promise<ApplicationWithCreator> {
    const app = await this.prisma.creatorApplication.findUnique({ where: { id }, include: { creator: { select: CREATOR_SUMMARY_SELECT } } });
    if (!app) throw new DomainException("NOT_FOUND", "Ariza topilmadi.");
    return app;
  }

  async findOneOrThrow(id: string): Promise<OnboardingAdminResponse> {
    return this.toAdminResponse(await this.findOneWithCreatorOrThrow(id));
  }

  async getAuditTrail(id: string): Promise<AuditLogEntry[]> {
    await this.findOneWithCreatorOrThrow(id); // 404s consistently rather than returning an empty trail for a bad id
    return this.audit.listForEntity("CreatorApplication", id);
  }

  async startReview(id: string, actorId: string): Promise<OnboardingAdminResponse> {
    const existing = await this.findOneWithCreatorOrThrow(id);
    if (!START_REVIEW_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", "Faqat yuborilgan arizani ko'rib chiqishni boshlash mumkin.", { from: existing.status });
    }
    await this.prisma.creatorApplication.update({ where: { id }, data: { status: "UNDER_REVIEW" } });
    await this.audit.record({ actorId, action: "ONBOARDING_REVIEW_STARTED", entityType: "CreatorApplication", entityId: id, before: { status: existing.status }, after: { status: "UNDER_REVIEW" } });
    return this.findOneOrThrow(id);
  }

  // The onboarding wizard's own "Ijtimoiy tarmoqlar" step already collects platform/handle/
  // profileUrl (OnboardingWizard.tsx's socialAccounts field array) — but it only ever lands in
  // this application's `formData` JSON blob, never in the real SocialAccount table that the admin
  // Launch Bonus bio-verification queue (and campaign eligibility checks) actually read from. That
  // meant the admin's "Social Accounts" card — which already renders a clickable link per
  // platform — could never show anything for any creator, ever: right approval gate, no way to
  // reach it. Syncing here, at the one moment a formData snapshot becomes "the creator's real
  // profile", closes that gap without needing a separate creator-facing edit endpoint.
  private async syncSocialAccountsFromFormData(creatorId: string, formData: Prisma.JsonValue): Promise<void> {
    if (!formData || typeof formData !== "object" || Array.isArray(formData)) return;
    const raw = (formData as Record<string, unknown>).socialAccounts;
    if (!Array.isArray(raw)) return;

    const valid = raw.filter(
      (a): a is { platform: string; handle: string; profileUrl: string; followerCount?: number } =>
        !!a &&
        typeof a === "object" &&
        typeof (a as Record<string, unknown>).platform === "string" &&
        (Object.values(SocialPlatform) as string[]).includes((a as Record<string, unknown>).platform as string) &&
        typeof (a as Record<string, unknown>).handle === "string" &&
        !!(a as Record<string, unknown>).handle &&
        typeof (a as Record<string, unknown>).profileUrl === "string" &&
        !!(a as Record<string, unknown>).profileUrl,
    );

    await this.prisma.socialAccount.deleteMany({ where: { creatorId } });
    if (valid.length === 0) return;
    await this.prisma.socialAccount.createMany({
      data: valid.map((a) => ({
        creatorId,
        platform: a.platform as SocialPlatform,
        handle: a.handle,
        profileUrl: a.profileUrl,
        followerCount: typeof a.followerCount === "number" && a.followerCount >= 0 ? Math.floor(a.followerCount) : 0,
      })),
    });
  }

  async approve(id: string, actorId: string): Promise<OnboardingAdminResponse> {
    const existing = await this.findOneWithCreatorOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", "Faqat ko'rib chiqilayotgan arizani tasdiqlash mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.creatorApplication.update({ where: { id }, data: { status: "APPROVED", reviewedAt: now, reviewedById: actorId } });
    await this.syncSocialAccountsFromFormData(existing.creatorId, existing.formData);
    await this.audit.record({ actorId, action: "ONBOARDING_APPROVED", entityType: "CreatorApplication", entityId: id, before: { status: existing.status }, after: { status: "APPROVED" } });
    await this.referrals.onCreatorApproved(existing.creatorId);
    await this.events.emitAsync(NOTIFICATION_EVENTS.ONBOARDING_APPROVED, { applicationId: id, creatorId: existing.creatorId, creatorName: existing.creator.displayName });
    return this.findOneOrThrow(id);
  }

  async reject(id: string, actorId: string, reason: string): Promise<OnboardingAdminResponse> {
    const existing = await this.findOneWithCreatorOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", "Faqat ko'rib chiqilayotgan arizani rad etish mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.creatorApplication.update({ where: { id }, data: { status: "REJECTED", reviewNote: reason, reviewedAt: now, reviewedById: actorId } });
    await this.audit.record({
      actorId,
      action: "ONBOARDING_REJECTED",
      entityType: "CreatorApplication",
      entityId: id,
      before: { status: existing.status },
      after: { status: "REJECTED", reason },
    });
    await this.events.emitAsync(NOTIFICATION_EVENTS.ONBOARDING_REJECTED, { applicationId: id, creatorId: existing.creatorId, creatorName: existing.creator.displayName, reason });
    return this.findOneOrThrow(id);
  }

  async requestChanges(id: string, actorId: string, reason: string): Promise<OnboardingAdminResponse> {
    const existing = await this.findOneWithCreatorOrThrow(id);
    if (!DECIDE_FROM.includes(existing.status)) {
      throw new DomainException("INVALID_ONBOARDING_TRANSITION", "Faqat ko'rib chiqilayotgan arizadan o'zgartirish so'ralishi mumkin.", { from: existing.status });
    }
    const now = new Date();
    await this.prisma.creatorApplication.update({ where: { id }, data: { status: "CHANGES_REQUESTED", reviewNote: reason, reviewedAt: now, reviewedById: actorId } });
    await this.audit.record({
      actorId,
      action: "ONBOARDING_CHANGES_REQUESTED",
      entityType: "CreatorApplication",
      entityId: id,
      before: { status: existing.status },
      after: { status: "CHANGES_REQUESTED", reason },
    });
    await this.events.emitAsync(NOTIFICATION_EVENTS.ONBOARDING_CHANGES_REQUESTED, { applicationId: id, creatorId: existing.creatorId, creatorName: existing.creator.displayName, reason });
    return this.findOneOrThrow(id);
  }
}
