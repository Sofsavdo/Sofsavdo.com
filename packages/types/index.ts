// Shared enums/types used by both apps/web and (from Phase 6) apps/api.
// Mirrors the enums in apps/api/prisma/schema.prisma — kept as plain TS unions here since the
// frontend doesn't depend on Prisma's generated client, only on the same vocabulary.

export type SocialPlatform = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "TELEGRAM";

// CHANGES_REQUESTED (renamed from REVISION_REQUESTED — Phase 11) matches the backend rename in
// apps/api schema.prisma and the identical state name CampaignApplicationStatus/ContentStatus
// already use. See DECISIONS.md ADR-018. REJECTED is resubmittable in this domain (not terminal
// like CampaignApplicationStatus's REJECTED) — see OnboardingPageClient.tsx.
export type CreatorApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export type ProductType = "PHYSICAL_PRODUCT" | "DIGITAL_PRODUCT" | "COURSE" | "SERVICE" | "CONSULTATION";

// Narrowed from PERCENTAGE|FIXED_PER_SALE|FIXED_CONTENT_FEE|HYBRID to the two explicit commercial
// modes the 6B Enhancement backend uses (see apps/api schema.prisma and DECISIONS.md ADR-013).
export type CommissionType = "PERCENTAGE" | "FIXED_AMOUNT";

export type CampaignMediaType = "IMAGE" | "VIDEO";
export type CampaignMediaRole = "COVER" | "GALLERY" | "PROMOTIONAL";

export interface CampaignMediaItem {
  id: string;
  mediaType: CampaignMediaType;
  mediaRole: CampaignMediaRole;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  altText?: string;
  sortOrder: number;
}
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

// OPEN and CANCELLED were retired in favor of this explicit 5-state model — see
// DECISIONS.md ADR-011.
export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type CampaignAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";
export type CampaignApplicationAvailability = "OPEN" | "NOT_STARTED" | "CLOSED" | "FULL" | "INACTIVE";
// The real backend's 7-state lifecycle (see apps/api schema.prisma CampaignApplicationStatus and
// DECISIONS.md ADR-012). "PENDING" is mock-mode legacy only — the in-memory store predates the
// lifecycle model and collapses SUBMITTED/UNDER_REVIEW into one waiting state.
export type CampaignApplicationStatus =
  | "PENDING"
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

// Creator-safe view of a campaign application (never adminNotes/reviewedById — the backend's
// ApplicationCreatorResponse shape, see creator-applications.service.ts).
export interface CampaignApplicationCreatorView {
  id: string;
  campaignId: string;
  status: CampaignApplicationStatus;
  message?: string;
  platform?: SocialPlatform;
  contentFormat?: string;
  portfolioLinks: string[];
  sampleContentLinks: string[];
  answers?: Record<string, unknown>;
  followerSnapshot?: number;
  rejectionReason?: string;
  changesRequestedReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  withdrawnAt?: string;
  createdAt: string;
  updatedAt: string;
  campaign: { id: string; name: string; slug: string; category: string };
}

// Admin view — everything the creator sees plus review-side fields and the creator summary.
export interface CampaignApplicationAdminView extends Omit<CampaignApplicationCreatorView, "campaign"> {
  adminNotes?: string;
  reviewedById?: string;
  creator: { id: string; displayName: string; city?: string };
  campaign: { id: string; name: string; slug: string; category: string };
}

export type CreatorCampaignStatus =
  | "APPLIED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PRODUCT_PREPARING"
  | "SHIPPED"
  | "CONTENT_REQUIRED"
  | "CONTENT_REVIEW"
  | "ACTIVE"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type CreatorContentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

// ---- Content domain (Phase 7A) — real backend only; distinct from the legacy CreatorContent
// mock-only shape above, which the mock store still uses unchanged. See DECISIONS.md ADR-014.
export type ContentStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED";
export type ContentAttachmentType = "IMAGE" | "VIDEO";
export type ContentAttachmentRole = "ATTACHMENT" | "THUMBNAIL";
export type ContentReviewAction = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface ContentAttachmentItem {
  id: string;
  attachmentType: ContentAttachmentType;
  role: ContentAttachmentRole;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sortOrder: number;
}

export interface ContentVersionItem {
  id: string;
  versionNumber: number;
  caption?: string;
  notes?: string;
  hashtags: string[];
  metadata?: Record<string, unknown>;
  submittedAt: string;
}

// authorId is present only on the admin view — creator-safe comments never expose reviewer identity.
export interface ContentCommentItem {
  id: string;
  versionNumber: number;
  action: ContentReviewAction;
  comment: string;
  createdAt: string;
  authorId?: string;
}

export interface ContentCampaignSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  contentDeadline?: string;
  requiredContentCount?: number;
}

export interface ContentCreatorView {
  id: string;
  campaignId: string;
  campaignApplicationId: string;
  status: ContentStatus;
  caption?: string;
  notes?: string;
  hashtags: string[];
  metadata?: Record<string, unknown>;
  currentVersionNumber: number;
  rejectionReason?: string;
  changesRequestedReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  createdAt: string;
  updatedAt: string;
  campaign: ContentCampaignSummary;
  attachments: ContentAttachmentItem[];
  versions: ContentVersionItem[];
  comments: ContentCommentItem[];
}

export interface ContentAdminView extends ContentCreatorView {
  reviewedById?: string;
  creator: { id: string; displayName: string; city?: string };
}

export type ContentDashboardCounts = Record<ContentStatus, number>;

export type CommissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED" | "PAYABLE" | "PAID";
export type PayoutStatus = "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED";
export type PayoutMethodType = "CARD" | "BANK_ACCOUNT";
export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED"
  | "REFUNDED";

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  profileUrl: string;
  followerCount: number;
}

export interface CreatorApplicationData {
  fullName?: string;
  phone?: string;
  city?: string;
  bio?: string;
  socialAccounts?: SocialAccount[];
  contentNiches?: string[];
  audienceAgeRange?: string;
  audienceGeography?: string;
  audienceInterests?: string;
  priorExperience?: string;
  payoutMethodType?: PayoutMethodType;
  payoutCardNumber?: string;
  payoutCardHolder?: string;
  payoutBankName?: string;
  payoutBankAccount?: string;
  termsAccepted?: boolean;
}

export interface CreatorApplication {
  id: string;
  status: CreatorApplicationStatus;
  currentStep: number;
  data: CreatorApplicationData;
  reviewNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

// Admin-facing view of the onboarding CreatorApplication review queue/detail (Phase 11) — real
// backend only, no mock counterpart of this shape (mock's admin review uses the plain CreatorUser
// list — see services/admin/creators.ts). Distinct from CampaignApplicationAdminView (a creator
// applying to join a specific Campaign, see ADR-012). See DECISIONS.md ADR-018.
export interface OnboardingApplicationAdminView {
  id: string;
  status: CreatorApplicationStatus;
  currentStep: number;
  formData: CreatorApplicationData;
  reviewNote?: string;
  reviewedById?: string;
  reviewedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; displayName: string; city?: string; email?: string };
}

export interface OnboardingAuditEntry {
  id: string;
  actorId: string | null;
  actor?: { id: string; email: string | null };
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export type CreatorAccountStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export interface CreatorUser {
  id: string;
  email: string;
  displayName: string;
  avatarInitials: string;
  // Every creator gets a DRAFT CreatorApplication at registration (both mock and real) — see
  // DECISIONS.md ADR-012 — so this is never actually absent for a real account.
  application: CreatorApplication;
  accountStatus?: CreatorAccountStatus;
}

export interface OfferSummary {
  id: string;
  name: string;
  slug: string;
  productType: ProductType;
  priceMinor: number;
  compareAtPriceMinor?: number;
  currency: string;
}

export interface Campaign {
  id: string;
  offerId: string;
  slug: string;
  name: string;
  // Admin-only fields, distinct from the creator-facing `name`/`description` — see
  // DECISIONS.md ADR-011. Only ever populated in admin responses.
  internalName?: string;
  internalNotes?: string;
  // Mock-mode legacy — a single cover URL string. Real mode uses `media` below instead.
  coverImage?: string;
  // Only populated in real mode (see CampaignMediaService) — cover/gallery/video/promotional,
  // creator-safe (no storageKey/provider metadata). Empty/absent in mock mode.
  media?: CampaignMediaItem[];
  offer: OfferSummary;
  description: string;
  goal: string;
  targetAudience: string;
  platforms: SocialPlatform[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  requiredContentCount?: number;
  contentDeadline?: string;
  startDate?: string;
  endDate?: string;
  applicationStartDate?: string;
  ctaLabel: string;
  commissionType: CommissionType;
  // Exactly one of these two is set, matching commissionType — see DECISIONS.md ADR-013.
  commissionRateBps?: number;
  commissionAmountMinor?: number;
  commissionCurrency?: string;
  customerDiscountType?: DiscountType;
  customerDiscountValue?: number;
  barterEnabled: boolean;
  freeProduct?: string;
  applicationDeadline: string;
  creatorLimit: number;
  approvedCreatorCount: number;
  status: CampaignStatus;
  requiresApproval: boolean;
  attributionWindowDays: number;
  assets?: { id: string; kind: "image" | "video" | "brief" | "logo" | "caption_template"; label: string }[];
  category: string;
  // Only populated when backed by the real API (see Offer/Landing's same convention).
  availability?: CampaignAvailability;
  applicationAvailability?: CampaignApplicationAvailability;
  // Always "CAMPAIGN" — Offer carries no creator-commission field to inherit from in this
  // architecture (see DECISIONS.md ADR-011); exposed for forward-compatibility with the spec's
  // "clearly expose whether inherited or overridden" requirement.
  commissionSource?: "CAMPAIGN";
  archivedAt?: string;
  // Admin-only, real-mode-only: whether the linked Offer's Landing is published (see
  // Landing domain) — informs whether the campaign is even activatable yet.
  landingAvailability?: "PUBLISHED" | "NOT_PUBLISHED" | "MISSING";
}

export interface CreatorCampaign {
  id: string;
  campaignId: string;
  campaign: Campaign;
  status: CreatorCampaignStatus;
  joinedAt: string;
  referralLink?: ReferralLink;
  promoCode?: PromoCode;
  rejectionReason?: string;
}

export interface ReferralLink {
  code: string;
  fullUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
}

export interface PromoCode {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  usageCount: number;
  usageLimit?: number;
}

export interface CreatorContent {
  id: string;
  creatorCampaignId: string;
  campaignName: string;
  status: CreatorContentStatus;
  caption?: string;
  platform?: SocialPlatform;
  publishedUrl?: string;
  draftFileNames: string[];
  reviewNote?: string;
  history: { status: CreatorContentStatus; note?: string; at: string }[];
  submittedAt?: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  orderPublicToken: string;
  createdAt: string;
  campaignName: string;
  offerName: string;
  customerMasked: string; // e.g. "A. Karimov, +998 90 *** ** 12"
  amountMinor: number;
  discountMinor: number;
  commissionBaseMinor: number;
  commissionMinor: number;
  orderStatus: OrderStatus;
  attributionSource: "PROMO_CODE" | "REFERRAL_VISIT";
}

export interface Commission {
  id: string;
  saleId: string;
  campaignName: string;
  baseAmountMinor: number;
  amountMinor: number;
  status: CommissionStatus;
  createdAt: string;
  payableAt?: string;
  paidAt?: string;
}

export interface PayoutMethod {
  id: string;
  type: PayoutMethodType;
  label: string; // masked, e.g. "•••• 4521 — Xurshid Aliyev"
  isDefault: boolean;
}

export interface Payout {
  id: string;
  amountMinor: number;
  status: PayoutStatus;
  payoutMethodLabel: string;
  requestedAt: string;
  paidAt?: string;
  rejectionReason?: string;
}

export interface BalanceSummary {
  pendingMinor: number;
  approvedMinor: number;
  availableMinor: number;
  payoutRequestedMinor: number;
  paidMinor: number;
  minimumPayoutMinor: number;
}

export interface DashboardSeriesPoint {
  date: string;
  clicks: number;
  orders: number;
  revenueMinor: number;
}

export interface DashboardStats {
  today: { clicks: number; orders: number; revenueMinor: number };
  monthToDate: { salesMinor: number; commissionMinor: number };
  pendingCommissionMinor: number;
  approvedCommissionMinor: number;
  availableBalanceMinor: number;
  conversionRate: number; // 0..1
  epcMinor: number; // earnings per click, minor units
  series7d: DashboardSeriesPoint[];
  series30d: DashboardSeriesPoint[];
  series90d: DashboardSeriesPoint[];
}

// ────────────────────────────────────────────────────────────────────────────
// Buyer-facing: public offer / landing / checkout (Phase 4)
// ────────────────────────────────────────────────────────────────────────────

export type LandingSectionType =
  | "HERO"
  | "PROBLEM"
  | "SOLUTION"
  | "BENEFITS"
  | "HOW_IT_WORKS"
  | "AUDIENCE"
  | "NOT_FOR"
  | "CREATOR_VIDEO"
  | "PRODUCT_GALLERY"
  | "PRICING"
  | "OFFER_VARIANTS"
  | "BONUSES"
  | "REVIEWS"
  | "GUARANTEE"
  | "TERMS"
  | "DELIVERY"
  | "PAYMENT"
  | "FAQ"
  | "FINAL_CTA"
  | "CUSTOM_RICH_TEXT";

export interface ReferralContext {
  creatorDisplayName: string;
  promoCode?: string;
  discountLabel?: string;
}

export type PromoValidationErrorCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "EXPIRED"
  | "USAGE_LIMIT_REACHED"
  | "INVALID_OFFER";

export interface PromoValidationResult {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  discountMinor: number;
}

export interface CheckoutCustomerInput {
  fullName: string;
  phone: string;
  region?: string;
  city?: string;
  district?: string;
  address?: string;
  email?: string;
  comment?: string;
}

export interface CreateOrderInput {
  offerSlug: string;
  variantId: string;
  promoCode?: string;
  refCode?: string;
  // Phase 8 additions — mock mode ignores all three (no delivery-region/attribution-visit/
  // fulfillment-method concept in the mock store); the real backend requires regionCode for
  // PHYSICAL_PRODUCT offers (see DeliveryService.resolveDeliveryFee) and uses visitorId to link a
  // paid order back to the ReferralVisit POST /offers/:slug/visit recorded on page load.
  regionCode?: string;
  visitorId?: string;
  deliveryMethod?: string;
  paymentMethod: string;
  customer: CheckoutCustomerInput;
  idempotencyKey: string;
}

export interface OrderPublic {
  id: string;
  publicToken: string;
  offerName: string;
  variantName: string;
  totalMinor: number;
  discountMinor: number;
  currency: string;
  paymentMethod: string;
  customer: CheckoutCustomerInput;
  createdAt: string;
  attributedCreatorName?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Admin (Phase 5): Product → Offer → Landing → Campaign, orders, money, ops
// ────────────────────────────────────────────────────────────────────────────

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type OfferStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
// Computed, never stored — see apps/api's OffersService.computeAvailability(). An ACTIVE offer
// past its expiresAt is still stored as ACTIVE (status transitions are admin-driven); this is
// what tells the UI/buyer flow whether it's actually purchasable right now.
export type OfferAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";
export type OfferCtaType = "BUY_NOW" | "ORDER_FORM" | "APPLY_NOW" | "BOOK_CALL" | "PAY_INSTALLMENT";
export type AdminRole = "MANAGER" | "ADMIN" | "SUPER_ADMIN";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  shortDescription?: string;
  images: string[];
  costPriceMinor?: number;
  sku?: string;
  attributes: { key: string; value: string }[];
  internalNotes?: string;
  status: ProductStatus;
  createdAt: string;
}

export interface AdminOfferVariant {
  id: string;
  name: string;
  priceMinor: number;
  isDefault: boolean;
}

// The admin-editable Offer record. `productId` links it to a Product; landing content lives
// separately in LandingSectionAdmin rows (one Offer → many sections), not embedded here — same
// separation as apps/api/prisma/schema.prisma's Offer/LandingPage/LandingSection models.
export interface Offer {
  id: string;
  productId: string;
  name: string;
  slug: string;
  headline: string;
  subheadline: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
  currency: string;
  variants: AdminOfferVariant[];
  bonuses: string[];
  deliveryInfo?: string;
  paymentOptions: string[];
  installmentOptions?: string;
  ctaType: OfferCtaType;
  ctaLabel: string;
  startsAt?: string;
  endsAt?: string;
  status: OfferStatus;
  // Only populated when backed by the real API (mock mode has no scheduled job / clock-driven
  // state to compute this from) — components must treat it as optional.
  availability?: OfferAvailability;
  isIndexable: boolean;
  createdAt: string;
}

// Regional delivery pricing (6B Enhancement) — owned by Offer, only meaningful for
// PHYSICAL_PRODUCT offers. Real-mode only; mock mode has no delivery-region data model, so this
// is always `[]` there (see DECISIONS.md ADR-013).
export interface DeliveryRegionPublic {
  regionCode: string;
  regionName: string;
  feeType: "FREE" | "FIXED";
  deliveryFeeMinor: number;
  currency: string;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
}

// Authoritative response of `POST /offers/:slug/quote` — the backend computes the total, the
// frontend never does its own arithmetic (see DECISIONS.md ADR-013).
export interface OfferQuote {
  priceMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: string;
  regionRequired: boolean;
  regionCode?: string;
  regionName?: string;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
}

export interface LandingSectionAdmin {
  id: string;
  offerId: string;
  type: LandingSectionType;
  sortOrder: number;
  isActive: boolean;
  content: Record<string, unknown>;
}

export type LandingStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// 1:1 with its Offer — no separate slug (see apps/api/prisma/schema.prisma's LandingStatus
// comment); the public route is keyed by the Offer's own slug (`GET /offers/:slug/public`).
export interface LandingPage {
  id: string;
  offerId: string;
  template: string;
  status: LandingStatus;
  publishedAt?: string;
  archivedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  ogImageUrl?: string;
  createdAt: string;
}

export interface CampaignAsset {
  id: string;
  kind: "image" | "video" | "brief" | "logo" | "caption_template";
  label: string;
}

export interface CampaignApplicationAdmin {
  id: string;
  campaignId: string;
  campaignName: string;
  creatorId: string;
  creatorName: string;
  status: CampaignApplicationStatus;
  message?: string;
  createdAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface AdminOrderItem {
  variantName: string;
  quantity: number;
  unitPriceMinor: number;
}

export type AdminOrderType = "PHYSICAL" | "DIGITAL" | "COURSE" | "SERVICE" | "LEAD";

export interface AdminOrder {
  id: string;
  publicToken: string;
  type: AdminOrderType;
  offerId: string;
  offerName: string;
  campaignId?: string;
  campaignName?: string;
  customer: CheckoutCustomerInput;
  status: OrderStatus;
  items: AdminOrderItem[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  attributionSource?: "PROMO_CODE" | "REFERRAL_VISIT";
  attributedCreatorId?: string;
  attributedCreatorName?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  commissionId?: string;
  statusHistory: { status: OrderStatus; at: string; note?: string; actor?: string }[];
  internalNotes?: string;
  createdAt: string;
}

export type PaymentStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export type RefundStatus = "REQUESTED" | "APPROVED" | "PROCESSED" | "REJECTED";

export interface AdminRefund {
  id: string;
  orderId: string;
  orderPublicToken: string;
  amountMinor: number;
  isPartial: boolean;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedAt?: string;
}

export interface AdminCommission {
  id: string;
  orderId: string;
  orderPublicToken: string;
  creatorId: string;
  creatorName: string;
  campaignName: string;
  commissionType: CommissionType;
  commissionValue: number;
  baseAmountMinor: number;
  amountMinor: number;
  status: CommissionStatus;
  ledger: { type: "ACCRUAL" | "REVERSAL" | "PAYOUT"; amountMinor: number; reason?: string; at: string }[];
  createdAt: string;
}

export interface AdminPayout {
  id: string;
  creatorId: string;
  creatorName: string;
  amountMinor: number;
  status: PayoutStatus;
  payoutMethodLabel: string;
  requestedAt: string;
  paidAt?: string;
  rejectionReason?: string;
  referenceNumber?: string;
}

export interface AdminReferralLink {
  code: string;
  fullUrl: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  offerName: string;
  clicks: number;
  orders: number;
  revenueMinor: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED";
  createdAt: string;
}

export interface AdminPromoCode {
  code: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  discountType: DiscountType;
  discountValue: number;
  usageCount: number;
  usageLimit?: number;
  isActive: boolean;
}

export interface AdminVisitor {
  id: string;
  visitorId: string;
  offerName: string;
  campaignName?: string;
  creatorName?: string;
  source: "PROMO_CODE" | "REFERRAL_VISIT" | "DIRECT";
  landingPage: string;
  createdAt: string;
  expiresAt: string;
  attributedOrderToken?: string;
  fraudRiskFlags: string[];
}

// --- formatting helpers shared by every page that renders money/dates ---

export function formatMoneyMinor(amountMinor: number, currency = "UZS"): string {
  const major = amountMinor / 100;
  const number = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(major);
  // Uzbek convention puts the unit after the number ("3 062 610 so'm"), not before it the way
  // Intl's currency style defaults to for "UZS" — so format the number and unit separately
  // rather than relying on Intl's currency-symbol placement.
  return currency === "UZS" ? `${number} so'm` : `${number} ${currency}`;
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toLocaleString("uz-UZ", { maximumFractionDigits: 1 })}%`;
}

// ---- Checkout/Payment/Order domain (Phase 8) — real backend only; distinct from the legacy
// mock-only OrderStatus/CreateOrderInput/OrderPublic/AdminOrder shapes above, which the mock store
// still uses unchanged. See DECISIONS.md ADR-015 for why the real OrderStatus set differs from the
// mock-era one (NEW/CONFIRMED/COMPLETED/RETURNED vs. this phase's checkout-lifecycle-accurate set).
export type RealOrderStatus = "CREATED" | "PAYMENT_PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type RealPaymentProvider = "CLICK" | "PAYME" | "UZUM_NASIYA" | "CARD" | "CASH_ON_DELIVERY" | "MANUAL";
export type RealPaymentStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface TrackVisitResult {
  visitorId: string;
  creatorDisplayName?: string;
  promoCode?: string;
}

export interface CheckoutCustomerInfo {
  fullName: string;
  phone: string;
  email?: string;
  region?: string;
  city?: string;
  district?: string;
  address?: string;
  notes?: string;
}

export interface CreateCheckoutInput {
  variantId?: string;
  regionCode?: string;
  promoCode?: string;
  refCode?: string;
  visitorId?: string;
  deliveryMethod?: string;
  paymentMethod: string;
  customer: CheckoutCustomerInfo;
  idempotencyKey: string;
}

export interface CheckoutOrderResult {
  publicToken: string;
  status: RealOrderStatus;
  offerName: string;
  variantName?: string;
  customer: { fullName: string; phone: string };
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  paymentRedirectUrl: string | null;
}

export interface RealAdminOrder {
  id: string;
  publicToken: string;
  status: RealOrderStatus;
  type: string;
  offer: { id: string; name: string; slug: string };
  campaign?: { id: string; name: string; slug: string };
  customer: { id: string; fullName: string; phone: string; email?: string };
  address?: { region: string; city: string; district?: string; line1: string; comment?: string };
  items: { id: string; nameSnapshot: string; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  deliveryMethod?: string;
  notes?: string;
  attribution?: { creatorId: string; campaignId: string; source: "PROMO_CODE" | "REFERRAL_VISIT" };
  commission?: { id: string; creatorId: string; creatorName: string; amountMinor: number; status: string };
  payment?: { id: string; provider: RealPaymentProvider; status: RealPaymentStatus; amountMinor: number; providerReference?: string };
  statusHistory: { fromStatus?: RealOrderStatus; toStatus: RealOrderStatus; note?: string; createdAt: string }[];
  refunds: { id: string; amountMinor: number; reason: string; status: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

// ---- Wallet, Commission Settlement & Payout domain (Phase 9) — real backend only; distinct from
// the legacy mock-only Commission/PayoutMethod/Payout/BalanceSummary shapes above. `PayoutStatus`
// above additionally differs in enum values from this domain's real set (no UNDER_REVIEW; adds
// CANCELLED/FAILED) — see DECISIONS.md ADR-016. `CommissionStatus` above is reused as-is: its
// values (PENDING/APPROVED/REJECTED/REFUNDED/PAYABLE/PAID) already match the real backend exactly.
export type RealPayoutStatus = "REQUESTED" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED" | "FAILED";

export interface RealWalletBalance {
  pendingMinor: number;
  availableMinor: number;
  lockedMinor: number;
  paidMinor: number;
  reversedMinor: number;
  currency: string;
  minimumPayoutMinor: number;
}

export interface RealWalletTransaction {
  id: string;
  type: "ACCRUAL" | "REVERSAL" | "PAYOUT";
  amountMinor: number;
  reason?: string;
  createdAt: string;
  commission: { id: string; orderPublicToken: string };
}

export interface RealPayoutMethod {
  id: string;
  type: PayoutMethodType;
  label: string;
  isDefault: boolean;
}

export interface RealPayout {
  id: string;
  amountMinor: number;
  currency: string;
  status: RealPayoutStatus;
  payoutMethodLabel: string;
  requestedAt: string;
  reviewedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
  commissionCount: number;
}

export interface RealAdminCommission {
  id: string;
  orderId: string;
  orderPublicToken: string;
  creator: { id: string; displayName: string };
  campaign: { id: string; name: string };
  commissionType: CommissionType;
  baseAmountMinor: number;
  amountMinor: number;
  currency: string;
  status: CommissionStatus;
  approvedAt?: string;
  payableAt?: string;
  paidAt?: string;
  payoutId?: string;
  ledger: { id: string; type: "ACCRUAL" | "REVERSAL" | "PAYOUT"; amountMinor: number; reason?: string; createdAt: string }[];
  createdAt: string;
}

export interface RealAdminPayout {
  id: string;
  creator: { id: string; displayName: string };
  payoutMethodLabel: string;
  amountMinor: number;
  currency: string;
  status: RealPayoutStatus;
  requestedAt: string;
  reviewedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
  commissionCount: number;
}

// ---- Communication & Notification domain (Phase 10) — real backend only, no mock counterpart
// (the mock store never had a real notification concept, only a stray
// `telegramNotificationsEnabled` settings flag). See DECISIONS.md ADR-017.
export type RealNotificationChannel = "IN_APP" | "TELEGRAM" | "EMAIL";
export type RealNotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED";
export type RealNotificationCategory = "CAMPAIGN_APPLICATION" | "ORDER" | "COMMISSION" | "PAYOUT" | "ACCOUNT" | "ADMIN_ALERTS";

export interface RealNotification {
  id: string;
  channel: RealNotificationChannel;
  type: string;
  payload: Record<string, unknown>;
  readAt?: string;
  status: RealNotificationDeliveryStatus;
  createdAt: string;
}

export interface RealAdminNotification extends RealNotification {
  user: { id: string; email: string | null; phone: string | null };
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
}

export interface RealNotificationPreference {
  category: RealNotificationCategory;
  inApp: boolean;
  telegram: boolean;
  email: boolean;
}

// ---- Admin Operations domain (Phase 12) — real backend only, no mock counterpart of these
// shapes (the mock's admin pages use the older, coarser AdminUser/AdminRole/AdminOrder/AdminRefund/
// AuditLogEntry types above). See DECISIONS.md ADR-019. ----

export type RealUserStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DELETED";

export interface RealStaffUser {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  status: RealUserStatus;
  lastLoginAt?: string;
  createdAt: string;
  roles: { id: string; key: string; name: string }[];
}

export interface RealRole {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  userCount: number;
}

export interface RealCreatorAdminListItem {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  city?: string;
  createdAt: string;
  accountStatus: RealUserStatus;
  onboardingStatus: CreatorApplicationStatus;
}

export interface RealCreatorAdminDetail extends RealCreatorAdminListItem {
  onboardingCurrentStep: number;
  onboardingSubmittedAt?: string;
  onboardingReviewedAt?: string;
  verified: boolean;
}

export interface RealCampaignHistoryItem {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  status: string;
  joinedAt: string;
  endedAt?: string;
}

export interface RealEarningsSummary {
  pendingMinor: number;
  approvedMinor: number;
  payableMinor: number;
  paidMinor: number;
  rejectedMinor: number;
  refundedMinor: number;
  currency: string;
}

export interface RealPayoutSummary {
  requestedMinor: number;
  approvedMinor: number;
  processingMinor: number;
  paidMinor: number;
  rejectedMinor: number;
  failedMinor: number;
  currency: string;
}

export interface RealAdminPayment {
  id: string;
  provider: string;
  status: string;
  amountMinor: number;
  currency: string;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
  order: { id: string; publicToken: string; offerName: string; customerName: string; customerPhone: string };
}

export interface RealPaymentTimelineEntry {
  label: string;
  at: string;
  detail?: unknown;
}

export interface RealAdminRefund {
  id: string;
  orderId: string;
  orderPublicToken: string;
  offerName: string;
  customerName: string;
  amountMinor: number;
  isPartial: boolean;
  reason: string;
  status: string;
  requestedById?: string;
  reviewedById?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  processedAt?: string;
  createdAt: string;
}

export type SettingCategory = "general" | "commission" | "creatorDefaults" | "notificationDefaults" | "paymentConfiguration" | "featureFlags" | "validationRules";

export interface RealSettingItem {
  key: string;
  category: SettingCategory;
  label: string;
  type: "string" | "number" | "boolean";
  value: string | number | boolean;
}

export interface RealAuditLogEntry {
  id: string;
  actorId: string | null;
  actor?: { id: string; email: string | null };
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

// Analytics & Business Intelligence domain (Phase 13) — real backend only, no mock counterpart.
// Field names/shapes mirror apps/api/src/analytics/*.service.ts exactly. See ANALYTICS.md and
// DECISIONS.md ADR-020 for the approved business definitions behind every field here.
export type AnalyticsRangePreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "quarter" | "year" | "custom";
export type AnalyticsCompareMode = "none" | "previous" | "wow" | "mom" | "yoy";

export interface AnalyticsFilters {
  range: AnalyticsRangePreset;
  from?: string;
  to?: string;
  compare?: AnalyticsCompareMode;
  creatorId?: string;
  campaignId?: string;
  productId?: string;
  paymentMethod?: string;
  region?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface RealDateRange {
  from: string;
  to: string;
}

export interface RealExecutiveMetrics {
  gmvMinor: number;
  revenueMinor: number;
  netRevenueMinor: number;
  ordersCount: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  refundsMinor: number;
  refundRate: number;
  activeCreatorsCount: number;
  activeCampaignsCount?: number;
  activeProductsCount?: number;
  creatorLinkConversionRate: number;
  averageOrderValueMinor: number;
  newCustomers: number;
  returningCustomers: number;
}

export interface RealDailyTrendPoint {
  day: string;
  ordersCount: number;
  revenueMinor: number;
}

export interface RealExecutiveAnalytics {
  current: RealExecutiveMetrics;
  previous?: RealExecutiveMetrics;
  deltaPct?: Partial<Record<keyof RealExecutiveMetrics, number | null>>;
  trend: RealDailyTrendPoint[];
  statusBreakdown: Array<{ status: string; count: number }>;
}

export interface RealCreatorAnalyticsListItem {
  creatorId: string;
  displayName: string;
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
}

export interface RealCreatorAnalyticsDetail {
  creatorId: string;
  displayName: string;
  range: RealDateRange;
  earningsByStatus: Record<string, number>;
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
  viewsCount: null;
  topCampaigns: Array<{ campaignId: string; name: string; ordersCount: number; revenueMinor: number }>;
  topProducts: Array<{ productId: string; name: string; ordersCount: number; revenueMinor: number }>;
  approvalRate: number;
  averagePayoutMinor: number;
  referralStats: { totalReferred: number; qualified: number; totalRewardsMinor: number };
}

export interface RealCampaignAnalyticsListItem {
  campaignId: string;
  name: string;
  status: string;
  ordersCount: number;
  revenueMinor: number;
  creatorCount: number;
}

export interface RealCampaignAnalyticsDetail {
  campaignId: string;
  name: string;
  status: string;
  range: RealDateRange;
  ordersCount: number;
  revenueMinor: number;
  clicksCount: number;
  conversionRate: number;
  creatorCount: number;
  averageCreatorRevenueMinor: number;
  topCreators: Array<{ creatorId: string; displayName: string; ordersCount: number; revenueMinor: number }>;
  trend: RealDailyTrendPoint[];
}

export interface RealProductAnalyticsListItem {
  productId: string;
  name: string;
  ordersCount: number;
  revenueMinor: number;
  refundsMinor: number;
  averageOrderValueMinor: number;
}

export interface RealProductAnalyticsDetail {
  productId: string;
  name: string;
  range: RealDateRange;
  ordersCount: number;
  revenueMinor: number;
  refundsMinor: number;
  refundedOrdersCount: number;
  clicksCount: number;
  conversionRate: number;
  averageOrderValueMinor: number;
  trend: RealDailyTrendPoint[];
}

export interface RealPaymentAnalytics {
  range: RealDateRange;
  totalCount: number;
  successRate: number;
  byMethod: Array<{ provider: string; count: number; amountMinor: number }>;
  pendingCount: number;
  failedCount: number;
  refundsMinor: number;
}

export interface RealRefundAnalytics {
  range: RealDateRange;
  requestedCount: number;
  refundRate: number;
  approvalRate: number;
  averageRefundAmountMinor: number;
  totalRefundedMinor: number;
  topReasons: Array<{ reason: string; count: number }>;
}

export interface RealCustomerAnalytics {
  range: RealDateRange;
  activeCustomersCount: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  averageLifetimeValueMinor: number;
  averageOrderFrequency: number;
}

export interface RealPaginatedAnalytics<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
