// Shared enums/types used by both apps/web and (from Phase 6) apps/api.
// Mirrors the enums in apps/api/prisma/schema.prisma — kept as plain TS unions here since the
// frontend doesn't depend on Prisma's generated client, only on the same vocabulary.

export type SocialPlatform = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "TELEGRAM";

export type CreatorApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export type ProductType = "PHYSICAL_PRODUCT" | "DIGITAL_PRODUCT" | "COURSE" | "SERVICE" | "CONSULTATION";

export type CommissionType = "PERCENTAGE" | "FIXED_PER_SALE" | "FIXED_CONTENT_FEE" | "HYBRID";
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export type CampaignStatus = "DRAFT" | "OPEN" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CampaignApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CreatorCampaignStatus =
  | "APPLIED"
  | "UNDER_REVIEW"
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

export type CreatorAccountStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export interface CreatorUser {
  id: string;
  email: string;
  displayName: string;
  avatarInitials: string;
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
  slug: string;
  name: string;
  coverImage: string;
  offer: OfferSummary;
  description: string;
  goal: string;
  targetAudience: string;
  platforms: SocialPlatform[];
  contentFormats: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  referenceContent?: string[];
  startDate?: string;
  endDate?: string;
  ctaLabel: string;
  commissionType: CommissionType;
  commissionValue: number; // bps if PERCENTAGE/HYBRID, minor units if FIXED_*
  fixedPaymentMinor?: number;
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
  assets: { id: string; kind: "image" | "video" | "brief" | "caption_template"; label: string }[];
  category: string;
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
  address?: string;
  email?: string;
  comment?: string;
}

export interface CreateOrderInput {
  offerSlug: string;
  variantId: string;
  promoCode?: string;
  refCode?: string;
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
export type OfferStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";
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
  isIndexable: boolean;
  createdAt: string;
}

export interface LandingSectionAdmin {
  id: string;
  offerId: string;
  type: LandingSectionType;
  sortOrder: number;
  isActive: boolean;
  content: Record<string, unknown>;
}

export interface CampaignAsset {
  id: string;
  kind: "image" | "video" | "brief" | "caption_template";
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
