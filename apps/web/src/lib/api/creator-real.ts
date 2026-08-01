// Real-backend implementation of the creator-facing API seam — counterpart to admin-real.ts,
// wired through lib/api/index.ts behind NEXT_PUBLIC_API_MODE. Reuses the exact same http-client
// (in-memory access token, one 401-then-refresh retry) as the admin seam — creator and admin
// sessions never share state (each browser tab holds exactly one access token at a time; logging
// in as one role naturally replaces whichever session was active before, same as switching admin
// accounts already worked).
import type {
  BioComplianceStatus,
  Campaign,
  CampaignApplicationCreatorView,
  CampaignMediaItem,
  CampaignMediaRole,
  CampaignMediaType,
  ContentAttachmentItem,
  ContentAttachmentRole,
  ContentAttachmentType,
  ContentCommentItem,
  ContentCreatorView,
  ContentDashboardCounts,
  ContentReviewAction,
  ContentStatus,
  CommissionStatus,
  CreatorCampaign,
  CreatorCampaignStatus,
  CreatorTier,
  CreatorUser,
  OrderStatus,
  Sale,
  SocialPlatform,
} from "@sofsavdo/types";
import { apiRequest, setAccessToken, ApiError } from "./http-client";

interface BackendSessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  roleKeys: string[];
  creatorId: string | null;
}

interface BackendCreatorProfile {
  id: string;
  email: string;
  displayName: string;
  application: {
    id: string;
    status: string;
    currentStep: number;
    data: unknown;
    reviewNote: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  };
}

function initials(displayName: string): string {
  return displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function buildCreatorUser(sessionUser: BackendSessionUser): Promise<CreatorUser> {
  if (!sessionUser.creatorId) {
    throw new ApiError("FORBIDDEN", "Bu hisob creator emas.", 403);
  }
  const profile = await apiRequest<BackendCreatorProfile>("/creator/profile");
  return {
    id: sessionUser.id,
    email: profile.email,
    displayName: profile.displayName,
    avatarInitials: initials(profile.displayName),
    application: {
      id: profile.application.id,
      status: profile.application.status as CreatorUser["application"]["status"],
      currentStep: profile.application.currentStep,
      data: (profile.application.data ?? {}) as CreatorUser["application"]["data"],
      reviewNote: profile.application.reviewNote ?? undefined,
      submittedAt: profile.application.submittedAt ?? undefined,
      reviewedAt: profile.application.reviewedAt ?? undefined,
    },
  };
}

export async function login(email: string, password: string): Promise<CreatorUser> {
  const result = await apiRequest<{ accessToken: string; user: BackendSessionUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setAccessToken(result.accessToken);
  return buildCreatorUser(result.user);
}

export async function register(
  email: string,
  fullName: string,
  password: string,
  referralCode?: string,
): Promise<CreatorUser> {
  const result = await apiRequest<{ accessToken: string; user: BackendSessionUser }>("/auth/register", {
    method: "POST",
    body: { email, password, displayName: fullName, referralCode },
  });
  setAccessToken(result.accessToken);
  return buildCreatorUser(result.user);
}

// Same fresh-page-load bootstrap pattern as admin-real.ts's adminGetSession: no in-memory token
// yet, apiRequest's 401-then-refresh recovers it from the HttpOnly cookie automatically.
export async function getSession(): Promise<CreatorUser | null> {
  try {
    const sessionUser = await apiRequest<BackendSessionUser>("/auth/me");
    return await buildCreatorUser(sessionUser);
  } catch (err) {
    if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) return null;
    throw err;
  }
}

export async function logout(): Promise<void> {
  setAccessToken(null);
  await apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
}

export async function forgotPassword(email: string): Promise<{ sent: boolean }> {
  await apiRequest("/auth/forgot-password", { method: "POST", body: { email } });
  return { sent: true };
}

interface BackendOnboardingApplication {
  id: string;
  status: string;
  currentStep: number;
  data: unknown;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

function mapOnboardingApplication(a: BackendOnboardingApplication): CreatorUser["application"] {
  return {
    id: a.id,
    status: a.status as CreatorUser["application"]["status"],
    currentStep: a.currentStep,
    data: (a.data ?? {}) as CreatorUser["application"]["data"],
    reviewNote: a.reviewNote ?? undefined,
    submittedAt: a.submittedAt ?? undefined,
    reviewedAt: a.reviewedAt ?? undefined,
  };
}

// Onboarding CreatorApplication draft/submit/resubmit (Phase 11) — distinct from the
// CampaignApplication update*/submit*/resubmit* functions below (a creator applying to join a
// specific Campaign, see ADR-012): this is the account-admission onboarding flow, gated behind
// nothing but a valid session (see /creator/onboarding — not RequireCreatorGuard, same reasoning
// as getSession above). See DECISIONS.md ADR-018.
export async function updateOnboardingApplication(currentStep: number, formData: Record<string, unknown>): Promise<CreatorUser["application"]> {
  return mapOnboardingApplication(await apiRequest<BackendOnboardingApplication>("/creator/onboarding", { method: "PATCH", body: { currentStep, formData } }));
}

export async function submitOnboardingApplication(): Promise<CreatorUser["application"]> {
  return mapOnboardingApplication(await apiRequest<BackendOnboardingApplication>("/creator/onboarding/submit", { method: "POST" }));
}

export async function resubmitOnboardingApplication(): Promise<CreatorUser["application"]> {
  return mapOnboardingApplication(await apiRequest<BackendOnboardingApplication>("/creator/onboarding/resubmit", { method: "POST" }));
}

interface BackendCreatorCampaignOffer {
  id: string;
  name: string;
  slug: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
}

interface BackendCreatorCampaignProduct {
  id: string;
  name: string;
  type: string;
}

// Shape returned by CampaignsService.toCreatorResponse() — deliberately narrower than the admin
// shape (no internalName/internalNotes/createdById/updatedById/archivedAt/raw stored `status`;
// see campaigns.service.ts's CampaignCreatorResponse).
interface BackendCreatorCampaign {
  id: string;
  offerId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  ctaLabel: string;
  goal: string | null;
  targetAudience: string | null;
  platforms: string[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  requiredContentCount: number | null;
  contentDeadline: string | null;
  startDate: string | null;
  endDate: string | null;
  applicationStartDate: string | null;
  applicationDeadline: string | null;
  creatorLimit: number | null;
  requiresApproval: boolean;
  commissionType: Campaign["commissionType"];
  commissionRateBps: number | null;
  commissionAmountMinor: number | null;
  commissionCurrency: string;
  customerDiscountType: Campaign["customerDiscountType"];
  customerDiscountValue: number | null;
  barterEnabled: boolean;
  freeProduct: string | null;
  attributionWindowDays: number;
  availability: Campaign["availability"];
  applicationAvailability: Campaign["applicationAvailability"];
  approvedCreatorCount: number;
  commissionSource: "CAMPAIGN";
  offer: BackendCreatorCampaignOffer;
  product: BackendCreatorCampaignProduct;
  media: BackendCreatorCampaignMedia[];
}

interface BackendCreatorCampaignMedia {
  id: string;
  mediaType: string;
  mediaRole: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  sortOrder: number;
}

function mapBackendCreatorCampaignMedia(m: BackendCreatorCampaignMedia): CampaignMediaItem {
  return {
    id: m.id,
    mediaType: m.mediaType as CampaignMediaType,
    mediaRole: m.mediaRole as CampaignMediaRole,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    durationSeconds: m.durationSeconds ?? undefined,
    altText: m.altText ?? undefined,
    sortOrder: m.sortOrder,
  };
}

function mapBackendCreatorCampaign(c: BackendCreatorCampaign): Campaign {
  return {
    id: c.id,
    offerId: c.offerId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    category: c.category,
    ctaLabel: c.ctaLabel,
    goal: c.goal ?? "",
    targetAudience: c.targetAudience ?? "",
    platforms: c.platforms as Campaign["platforms"],
    contentFormats: c.contentFormats,
    requiredElements: c.requiredElements,
    forbiddenElements: c.forbiddenElements,
    referenceContent: c.referenceContent,
    minFollowers: c.minFollowers ?? undefined,
    maxFollowers: c.maxFollowers ?? undefined,
    requiredContentCount: c.requiredContentCount ?? undefined,
    contentDeadline: c.contentDeadline ?? undefined,
    startDate: c.startDate ?? undefined,
    endDate: c.endDate ?? undefined,
    applicationStartDate: c.applicationStartDate ?? undefined,
    applicationDeadline: c.applicationDeadline ?? "",
    creatorLimit: c.creatorLimit ?? 0,
    requiresApproval: c.requiresApproval,
    commissionType: c.commissionType,
    commissionRateBps: c.commissionRateBps ?? undefined,
    commissionAmountMinor: c.commissionAmountMinor ?? undefined,
    commissionCurrency: c.commissionCurrency,
    media: c.media.map(mapBackendCreatorCampaignMedia),
    customerDiscountType: c.customerDiscountType ?? undefined,
    customerDiscountValue: c.customerDiscountValue ?? undefined,
    barterEnabled: c.barterEnabled,
    freeProduct: c.freeProduct ?? undefined,
    attributionWindowDays: c.attributionWindowDays,
    // The creator API only ever returns campaigns with availability === "LIVE" (server-enforced —
    // see campaigns.service.ts's findOneForCreatorOrThrow/listForCreator), which by definition
    // means status === "ACTIVE"; the backend's creator response omits the raw `status` field
    // deliberately (see "administrative metadata" in PROJECT_STATUS.md), so this is a safe,
    // always-true inference, not a guess.
    status: "ACTIVE",
    availability: c.availability,
    applicationAvailability: c.applicationAvailability,
    approvedCreatorCount: c.approvedCreatorCount,
    commissionSource: c.commissionSource,
    offer: {
      id: c.offer.id,
      name: c.offer.name,
      slug: c.offer.slug,
      productType: c.product.type as Campaign["offer"]["productType"],
      priceMinor: c.offer.priceMinor,
      compareAtPriceMinor: c.offer.compareAtPriceMinor ?? undefined,
      currency: c.offer.currency,
    },
  };
}

export async function getCampaigns(): Promise<Campaign[]> {
  const items = await apiRequest<BackendCreatorCampaign[]>("/creator/campaigns");
  return items.map(mapBackendCreatorCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    return mapBackendCreatorCampaign(await apiRequest<BackendCreatorCampaign>(`/creator/campaigns/${id}`));
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  }
}

// ---- Campaign applications (Creator Application domain) ----

export interface CampaignApplicationInput {
  message?: string;
  platform?: SocialPlatform;
  contentFormat?: string;
  portfolioLinks?: string[];
  sampleContentLinks?: string[];
  answers?: Record<string, unknown>;
}

interface BackendCampaignApplication {
  id: string;
  campaignId: string;
  status: CampaignApplicationCreatorView["status"];
  message: string | null;
  platform: SocialPlatform | null;
  contentFormat: string | null;
  portfolioLinks: string[];
  sampleContentLinks: string[];
  answers: Record<string, unknown> | null;
  followerSnapshot: number | null;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: { id: string; name: string; slug: string; category: string };
}

function mapApplication(a: BackendCampaignApplication): CampaignApplicationCreatorView {
  return {
    id: a.id,
    campaignId: a.campaignId,
    status: a.status,
    message: a.message ?? undefined,
    platform: a.platform ?? undefined,
    contentFormat: a.contentFormat ?? undefined,
    portfolioLinks: a.portfolioLinks,
    sampleContentLinks: a.sampleContentLinks,
    answers: a.answers ?? undefined,
    followerSnapshot: a.followerSnapshot ?? undefined,
    rejectionReason: a.rejectionReason ?? undefined,
    changesRequestedReason: a.changesRequestedReason ?? undefined,
    submittedAt: a.submittedAt ?? undefined,
    reviewedAt: a.reviewedAt ?? undefined,
    approvedAt: a.approvedAt ?? undefined,
    rejectedAt: a.rejectedAt ?? undefined,
    withdrawnAt: a.withdrawnAt ?? undefined,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    campaign: a.campaign,
  };
}

export async function getMyCampaignApplications(): Promise<CampaignApplicationCreatorView[]> {
  const items = await apiRequest<BackendCampaignApplication[]>("/creator/applications");
  return items.map(mapApplication);
}

export async function createCampaignApplication(campaignId: string, input: CampaignApplicationInput): Promise<CampaignApplicationCreatorView> {
  return mapApplication(
    await apiRequest<BackendCampaignApplication>(`/creator/campaigns/${campaignId}/applications`, { method: "POST", body: input }),
  );
}

export async function updateCampaignApplication(id: string, input: CampaignApplicationInput): Promise<CampaignApplicationCreatorView> {
  return mapApplication(await apiRequest<BackendCampaignApplication>(`/creator/applications/${id}`, { method: "PATCH", body: input }));
}

export async function submitCampaignApplication(id: string): Promise<CampaignApplicationCreatorView> {
  return mapApplication(await apiRequest<BackendCampaignApplication>(`/creator/applications/${id}/submit`, { method: "POST" }));
}

export async function resubmitCampaignApplication(id: string): Promise<CampaignApplicationCreatorView> {
  return mapApplication(await apiRequest<BackendCampaignApplication>(`/creator/applications/${id}/resubmit`, { method: "POST" }));
}

export async function withdrawCampaignApplication(id: string): Promise<CampaignApplicationCreatorView> {
  return mapApplication(await apiRequest<BackendCampaignApplication>(`/creator/applications/${id}/withdraw`, { method: "POST" }));
}

// One-click apply used by the campaign detail page's form: create the DRAFT and submit it in
// sequence. On a requiresApproval=false campaign the backend instant-approves the submit, exactly
// like the mock's one-shot apiApplyToCampaign always behaved.
export async function applyToCampaign(campaignId: string, input: CampaignApplicationInput): Promise<CampaignApplicationCreatorView> {
  const created = await createCampaignApplication(campaignId, input);
  return submitCampaignApplication(created.id);
}

// GET /creator/my-campaigns — the server-synthesized merged view over application status +
// (post-approval) CreatorCampaign membership status mandated by docs/SCHEMA_API_AUDIT.md.
interface BackendMyCampaign {
  id: string;
  campaignId: string;
  status: CreatorCampaignStatus;
  joinedAt: string;
  rejectionReason: string | null;
  campaign: {
    id: string;
    name: string;
    slug: string;
    category: string;
    ctaLabel: string;
    commissionType: Campaign["commissionType"];
    commissionRateBps: number | null;
    commissionAmountMinor: number | null;
    commissionCurrency: string;
    offer: { id: string; name: string; slug: string; priceMinor: number; compareAtPriceMinor: number | null; currency: string };
  };
  referralLink: { code: string; url: string; clicks: number; createdAt: string } | null;
}

export async function getMyCampaigns(): Promise<CreatorCampaign[]> {
  const items = await apiRequest<BackendMyCampaign[]>("/creator/my-campaigns");
  return items.map((m) => ({
    id: m.id,
    campaignId: m.campaignId,
    status: m.status,
    joinedAt: m.joinedAt,
    rejectionReason: m.rejectionReason ?? undefined,
    // The my-campaigns endpoint deliberately returns a campaign *summary* (name/category/CTA/
    // commission/offer) — every list surface that renders CreatorCampaign uses only these fields;
    // anything needing the full campaign fetches GET /creator/campaigns/:id separately. The cast
    // documents that gap instead of inventing fake values for the unused config fields.
    campaign: {
      id: m.campaign.id,
      name: m.campaign.name,
      slug: m.campaign.slug,
      category: m.campaign.category,
      ctaLabel: m.campaign.ctaLabel,
      commissionType: m.campaign.commissionType,
      commissionRateBps: m.campaign.commissionRateBps ?? undefined,
      commissionAmountMinor: m.campaign.commissionAmountMinor ?? undefined,
      commissionCurrency: m.campaign.commissionCurrency,
      offer: {
        id: m.campaign.offer.id,
        name: m.campaign.offer.name,
        slug: m.campaign.offer.slug,
        priceMinor: m.campaign.offer.priceMinor,
        compareAtPriceMinor: m.campaign.offer.compareAtPriceMinor ?? undefined,
        currency: m.campaign.offer.currency,
      },
    } as Campaign,
    referralLink: m.referralLink
      ? { code: m.referralLink.code, fullUrl: m.referralLink.url, shortUrl: m.referralLink.url, clicks: m.referralLink.clicks, createdAt: m.referralLink.createdAt }
      : undefined,
    // promoCode intentionally absent — a per-creator discount-code-on-top-of-the-referral-link is
    // a separate, not-yet-built feature (see PromoCode model); the referral link alone is enough
    // to attribute a sale, so this isn't a blocker for sharing.
  }));
}

// ---- Creator-to-creator referral program (6B Enhancement) ----

export type ReferralActivityClass =
  | "NEW"
  | "ONBOARDING_STALLED"
  | "AWAITING_APPROVAL"
  | "APPROVED_INACTIVE"
  | "ACTIVE_NO_EARNINGS"
  | "EARNING"
  | "DORMANT";

export interface ReferralSummary {
  referralCode: string;
  invitationLink: string;
  totalInvited: number;
  activeCount: number;
  needsEncouragementCount: number;
  earningCount: number;
  pendingRewardMinor: number;
  approvedRewardMinor: number;
  paidRewardMinor: number;
  currency: string;
}

export interface ReferredFriend {
  id: string;
  referredCreatorId: string;
  displayName: string;
  registeredAt: string;
  onboardingStatus: string;
  activity: ReferralActivityClass;
  lastMeaningfulActivityAt: string;
  campaignApplicationCount: number;
  approvedCampaignApplicationCount: number;
  contentSubmittedCount: number;
  approvedContentCount: number;
  qualifiedSaleCount: number;
  cumulativeQualifiedEarningsMinor: number;
  qualifiedAt: string | null;
  disqualifiedAt: string | null;
  pendingRewardMinor: number;
  approvedRewardMinor: number;
  paidRewardMinor: number;
}

export interface ReferralReward {
  id: string;
  referralId: string;
  referredDisplayName: string;
  ruleName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  qualifiedEarningsMinor: number | null;
  calculatedRewardMinor: number;
  currency: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function getReferralCode(): Promise<{ referralCode: string; invitationLink: string }> {
  return apiRequest("/creator/referral-code");
}

export async function getReferralSummary(): Promise<ReferralSummary> {
  return apiRequest("/creator/referrals/summary");
}

export async function getMyReferrals(): Promise<ReferredFriend[]> {
  return apiRequest("/creator/referrals");
}

export async function getMyReferralRewards(): Promise<ReferralReward[]> {
  return apiRequest("/creator/referral-rewards");
}

// ---- Content (Phase 7A) — real backend only; distinct from the legacy mock-only CreatorContent
// flow (apps/web/src/mocks/store.ts / services/content.ts), which stays untouched. ----

interface BackendContentAttachment {
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

interface BackendContentVersion {
  id: string;
  versionNumber: number;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: unknown;
  postUrl: string | null;
  submittedAt: string;
}

interface BackendContentComment {
  id: string;
  versionNumber: number;
  action: string;
  comment: string;
  createdAt: string;
  authorId?: string;
}

interface BackendContent {
  id: string;
  campaignId: string;
  campaignApplicationId: string;
  status: string;
  caption: string | null;
  notes: string | null;
  hashtags: string[];
  metadata: unknown;
  postUrl: string | null;
  currentVersionNumber: number;
  rejectionReason: string | null;
  changesRequestedReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign: { id: string; name: string; slug: string; category: string; contentDeadline: string | null; requiredContentCount: number | null };
  attachments: BackendContentAttachment[];
  versions: BackendContentVersion[];
  comments: BackendContentComment[];
}

function mapContentAttachment(a: BackendContentAttachment): ContentAttachmentItem {
  return {
    id: a.id,
    attachmentType: a.attachmentType as ContentAttachmentType,
    role: a.role as ContentAttachmentRole,
    url: a.url,
    thumbnailUrl: a.thumbnailUrl ?? undefined,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    durationSeconds: a.durationSeconds ?? undefined,
    sortOrder: a.sortOrder,
  };
}

function mapContentVersion(
  v: BackendContentVersion,
): { id: string; versionNumber: number; caption?: string; notes?: string; hashtags: string[]; metadata?: Record<string, unknown>; postUrl?: string; submittedAt: string } {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    caption: v.caption ?? undefined,
    notes: v.notes ?? undefined,
    hashtags: v.hashtags,
    metadata: (v.metadata as Record<string, unknown> | null) ?? undefined,
    postUrl: v.postUrl ?? undefined,
    submittedAt: v.submittedAt,
  };
}

function mapContentComment(c: BackendContentComment): ContentCommentItem {
  return { id: c.id, versionNumber: c.versionNumber, action: c.action as ContentReviewAction, comment: c.comment, createdAt: c.createdAt, authorId: c.authorId };
}

function mapContent(c: BackendContent): ContentCreatorView {
  return {
    id: c.id,
    campaignId: c.campaignId,
    campaignApplicationId: c.campaignApplicationId,
    status: c.status as ContentStatus,
    caption: c.caption ?? undefined,
    notes: c.notes ?? undefined,
    hashtags: c.hashtags,
    metadata: (c.metadata as Record<string, unknown> | null) ?? undefined,
    postUrl: c.postUrl ?? undefined,
    currentVersionNumber: c.currentVersionNumber,
    rejectionReason: c.rejectionReason ?? undefined,
    changesRequestedReason: c.changesRequestedReason ?? undefined,
    submittedAt: c.submittedAt ?? undefined,
    reviewedAt: c.reviewedAt ?? undefined,
    approvedAt: c.approvedAt ?? undefined,
    rejectedAt: c.rejectedAt ?? undefined,
    expiredAt: c.expiredAt ?? undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    campaign: {
      id: c.campaign.id,
      name: c.campaign.name,
      slug: c.campaign.slug,
      category: c.campaign.category,
      contentDeadline: c.campaign.contentDeadline ?? undefined,
      requiredContentCount: c.campaign.requiredContentCount ?? undefined,
    },
    attachments: c.attachments.map(mapContentAttachment),
    versions: c.versions.map(mapContentVersion),
    comments: c.comments.map(mapContentComment),
  };
}

export interface CreateContentInput {
  caption?: string;
  notes?: string;
  hashtags?: string[];
  metadata?: Record<string, unknown>;
  postUrl?: string;
}

export async function createContent(campaignId: string, input: CreateContentInput): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/campaigns/${campaignId}/contents`, { method: "POST", body: input }));
}

export async function getMyContents(): Promise<ContentCreatorView[]> {
  const items = await apiRequest<BackendContent[]>("/creator/contents");
  return items.map(mapContent);
}

export async function getMyContentDashboardCounts(): Promise<ContentDashboardCounts> {
  return apiRequest("/creator/contents/dashboard-counts");
}

export async function getContent(id: string): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/contents/${id}`));
}

export async function updateContent(id: string, input: CreateContentInput): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/contents/${id}`, { method: "PATCH", body: input }));
}

export async function submitContent(id: string): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/contents/${id}/submit`, { method: "POST" }));
}

export async function resubmitContent(id: string): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/contents/${id}/resubmit`, { method: "POST" }));
}

export interface UploadContentAttachmentInput {
  file: File;
  role: ContentAttachmentRole;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

function attachmentFormData(input: UploadContentAttachmentInput): FormData {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("role", input.role);
  if (input.width != null) fd.append("width", String(input.width));
  if (input.height != null) fd.append("height", String(input.height));
  if (input.durationSeconds != null) fd.append("durationSeconds", String(input.durationSeconds));
  return fd;
}

export async function uploadContentAttachment(contentId: string, input: UploadContentAttachmentInput): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/contents/${contentId}/attachments`, { method: "POST", body: attachmentFormData(input) }));
}

export async function deleteContentAttachment(attachmentId: string): Promise<ContentCreatorView> {
  return mapContent(await apiRequest<BackendContent>(`/creator/content-attachments/${attachmentId}`, { method: "DELETE" }));
}

// ---- Sales (Phase A, production-hardening pass) ----

// Real backend's Order.status (see CommissionsService.listMySales) has finer-grained states than
// the legacy mock `OrderStatus` this read-only summary page/table was built against (NEW/
// CONFIRMED/PROCESSING/SHIPPED/DELIVERED/COMPLETED/CANCELLED/RETURNED/REFUNDED) — deliberately
// mapped down rather than widening `Sale`/`SalesTable` to the real enum, since /creator/sales is a
// glanceable "did I get paid" summary, not an operational order-management surface (that fidelity
// already exists, for staff, on /admin/orders via RealOrderStatus). Two real states collapse into
// one legacy bucket by design: PAYMENT_PENDING joins CREATED under "NEW" (nothing sellable has
// happened yet either way) and IN_TRANSIT joins SHIPPED under "SHIPPED" (both read as "on the way"
// to a creator who takes no action here regardless).
const REAL_TO_LEGACY_ORDER_STATUS: Record<string, OrderStatus> = {
  CREATED: "NEW",
  PAYMENT_PENDING: "NEW",
  PAID: "CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  IN_TRANSIT: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

interface BackendCreatorSale {
  id: string;
  orderPublicToken: string;
  createdAt: string;
  campaignName: string;
  offerName: string;
  customerMasked: string;
  amountMinor: number;
  discountMinor: number;
  commissionBaseMinor: number;
  commissionMinor: number;
  orderStatus: string;
  attributionSource: "PROMO_CODE" | "REFERRAL_VISIT" | "MANUAL";
}

export async function getMySales(): Promise<Sale[]> {
  const items = await apiRequest<BackendCreatorSale[]>("/creator/sales");
  return items.map((s) => ({
    id: s.id,
    orderPublicToken: s.orderPublicToken,
    createdAt: s.createdAt,
    campaignName: s.campaignName,
    offerName: s.offerName,
    customerMasked: s.customerMasked,
    amountMinor: s.amountMinor,
    discountMinor: s.discountMinor,
    commissionBaseMinor: s.commissionBaseMinor,
    commissionMinor: s.commissionMinor,
    orderStatus: REAL_TO_LEGACY_ORDER_STATUS[s.orderStatus] ?? "NEW",
    // MANUAL attribution (admin override) has no legacy-mock equivalent — falls back to
    // REFERRAL_VISIT since that's the more common real-world cause a manual correction fixes.
    attributionSource: s.attributionSource === "PROMO_CODE" ? "PROMO_CODE" : "REFERRAL_VISIT",
  }));
}

// ---- Dashboard stats (Phase J) — replaces the previous 100%-mocked apiGetDashboardStats, which
// was never gated behind USE_REAL_API at all (see DECISIONS.md ADR-029). Field names match
// CreatorDashboardStats (apps/api/src/creator-dashboard/creator-dashboard.service.ts) 1:1 — no
// adapter needed, same no-rename precedent as Landing's LandingResponse/LandingPage.

export interface DashboardPeriodStats {
  ordersCount: number;
  salesMinor: number;
  commissionMinor: number;
}

export interface DashboardWallet {
  pendingMinor: number;
  availableMinor: number;
  lockedMinor: number;
  paidMinor: number;
  reversedMinor: number;
  donatedMinor: number;
  currency: string;
  minimumPayoutMinor: number;
}

// Phase O — the creator-facing counterpart of the admin dashboard's funnel, same 3 real stages
// (Click → Order → Paid order), scoped to this creator's own referral traffic.
export interface DashboardFunnel {
  period: "this_month";
  clicks: number;
  orders: number;
  paidOrders: number;
  conversionRate: number;
}

export interface DashboardStats {
  today: DashboardPeriodStats & { clicks: number; conversionRate: number };
  monthToDate: DashboardPeriodStats;
  lifetime: DashboardPeriodStats;
  wallet: DashboardWallet;
  dailyRevenue30d: { date: string; revenueMinor: number }[];
  funnel: DashboardFunnel;
  compliance: { bioComplianceStatus: BioComplianceStatus; tier: CreatorTier };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/creator/dashboard-stats");
}

// ---- Leaderboard (Phase K) — real backend only, no mock counterpart (a brand-new competitive/
// motivational surface — same "real backend only" precedent as Content/Order management above).

export interface LeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  commissionMinor: number;
  ordersCount: number;
}

export interface LeaderboardResponse {
  period: "this_month";
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  return apiRequest<LeaderboardResponse>("/creator/leaderboard");
}

// ---- Competitions (Phase L) — real backend only, no mock counterpart. Field names match
// CompetitionResponse/CompetitionLeaderboardResponse 1:1.

export type CompetitionAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";

export interface CreatorCompetition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  prizeDescription: string | null;
  startAt: string;
  endAt: string;
  availability: CompetitionAvailability;
}

export async function getMyCompetitions(): Promise<CreatorCompetition[]> {
  return apiRequest<CreatorCompetition[]>("/creator/competitions");
}

export interface CompetitionLeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  commissionMinor: number;
  ordersCount: number;
}

export interface CompetitionLeaderboardResponse {
  competitionId: string;
  top: CompetitionLeaderboardEntry[];
  me: CompetitionLeaderboardEntry | null;
}

export async function getCompetitionLeaderboard(competitionId: string): Promise<CompetitionLeaderboardResponse> {
  return apiRequest<CompetitionLeaderboardResponse>(`/creator/competitions/${competitionId}/leaderboard`);
}

export async function joinCompetition(competitionId: string): Promise<{ joined: boolean }> {
  return apiRequest<{ joined: boolean }>(`/creator/competitions/${competitionId}/join`, { method: "POST" });
}

// ---- Activity ticker (Phase N) — real backend only, no mock counterpart. Field names match
// ActivityTickerResponse (apps/api/src/activity-ticker/activity-ticker.service.ts) 1:1.

export type ActivityEventType = "SALE" | "PAYOUT" | "FUND_CONTRIBUTION";

export interface ActivityEvent {
  type: ActivityEventType;
  creatorDisplayName: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
}

export interface ActivityTickerResponse {
  events: ActivityEvent[];
}

export async function getActivityTicker(): Promise<ActivityTickerResponse> {
  return apiRequest<ActivityTickerResponse>("/creator/activity-ticker");
}

// ---- Creator Fund (Phase N) — real backend only, no mock counterpart. Field names match
// CreatorFundService's responses (apps/api/src/creator-fund/creator-fund.service.ts) 1:1.

export interface CreatorFundContributionResponse {
  id: string;
  amountMinor: number;
  currency: string;
  message: string | null;
  createdAt: string;
}

export interface CreatorFundStatsResponse {
  totalMinor: number;
  currency: string;
  myTotalMinor: number;
}

export interface CreatorFundLeaderboardEntry {
  rank: number;
  creatorId: string;
  displayName: string;
  totalMinor: number;
}

export interface CreatorFundLeaderboardResponse {
  top: CreatorFundLeaderboardEntry[];
  me: CreatorFundLeaderboardEntry | null;
}

export async function getFundStats(): Promise<CreatorFundStatsResponse> {
  return apiRequest<CreatorFundStatsResponse>("/creator/fund");
}

export async function getFundLeaderboard(): Promise<CreatorFundLeaderboardResponse> {
  return apiRequest<CreatorFundLeaderboardResponse>("/creator/fund/leaderboard");
}

export async function contributeToFund(amountMinor: number, message?: string): Promise<CreatorFundContributionResponse> {
  return apiRequest<CreatorFundContributionResponse>("/creator/fund/contribute", { method: "POST", body: { amountMinor, message } });
}

// ---- Commissions (Phase M) — real backend only, replacing a previously 100%-mocked page with
// zero USE_REAL_API gating at all (see DECISIONS.md ADR-031). Field names match
// CreatorCommissionResponse (apps/api/src/commissions/commissions.service.ts) 1:1 — a real
// Commission.status (PENDING/APPROVED/REJECTED/REFUNDED/PAYABLE/PAID), distinct from the legacy
// mock Commission type's saleId/payableAt/paidAt shape.

export interface CreatorCommission {
  id: string;
  orderPublicToken: string;
  campaignName: string;
  commissionType: string;
  baseAmountMinor: number;
  amountMinor: number;
  currency: string;
  status: CommissionStatus;
  createdAt: string;
}

export async function getMyCommissions(): Promise<CreatorCommission[]> {
  return apiRequest<CreatorCommission[]>("/creator/commissions");
}
