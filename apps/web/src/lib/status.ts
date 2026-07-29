import type {
  Campaign,
  BioComplianceStatus,
  CampaignApplicationStatus,
  CampaignStatus,
  CommissionStatus,
  CreatorTier,
  ContentReviewAction,
  ContentStatus,
  CreatorAccountStatus,
  CreatorApplicationStatus,
  CreatorCampaignStatus,
  CreatorContentStatus,
  LandingStatus,
  Offer,
  OfferStatus,
  OrderStatus,
  PayoutStatus,
  ProductStatus,
  RealNotificationCategory,
  RealNotificationChannel,
  RealNotificationDeliveryStatus,
  RealOrderStatus,
  RealPayoutStatus,
  RefundStatus,
} from "@sofsavdo/types";

export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

export const applicationStatusMeta: Record<CreatorApplicationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SUBMITTED: { label: "Yuborildi", tone: "info" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  CHANGES_REQUESTED: { label: "Tuzatish talab qilinadi", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
};

export const creatorCampaignStatusMeta: Record<CreatorCampaignStatus, { label: string; tone: Tone }> = {
  APPLIED: { label: "Ariza yuborildi", tone: "neutral" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  CHANGES_REQUESTED: { label: "O'zgartirish so'raldi", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  PRODUCT_PREPARING: { label: "Mahsulot tayyorlanmoqda", tone: "info" },
  SHIPPED: { label: "Jo'natildi", tone: "info" },
  CONTENT_REQUIRED: { label: "Kontent talab qilinadi", tone: "warning" },
  CONTENT_REVIEW: { label: "Kontent tekshiruvda", tone: "info" },
  ACTIVE: { label: "Faol", tone: "success" },
  COMPLETED: { label: "Yakunlangan", tone: "neutral" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
  CANCELLED: { label: "Bekor qilingan", tone: "neutral" },
};

export const contentStatusMeta: Record<CreatorContentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SUBMITTED: { label: "Yuborildi", tone: "info" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  REVISION_REQUESTED: { label: "Tuzatish kerak", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  PUBLISHED: { label: "E'lon qilingan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
};

export const commissionStatusMeta: Record<CommissionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Kutilmoqda", tone: "neutral" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
  REFUNDED: { label: "Qaytarilgan", tone: "error" },
  PAYABLE: { label: "To'lovga tayyor", tone: "success" },
  PAID: { label: "To'langan", tone: "success" },
  DONATED: { label: "Fondga ulashilgan", tone: "info" },
};

export const payoutStatusMeta: Record<PayoutStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: "So'ralgan", tone: "neutral" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'landi", tone: "success" },
  REJECTED: { label: "Rad etildi", tone: "error" },
};

// Real Wallet/Payout domain (Phase 9) — distinct from payoutStatusMeta above, which stays wired
// to the legacy mock PayoutStatus shape (no CANCELLED/FAILED, has UNDER_REVIEW). See
// DECISIONS.md ADR-016.
export const realPayoutStatusMeta: Record<RealPayoutStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: "So'ralgan", tone: "neutral" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'landi", tone: "success" },
  REJECTED: { label: "Rad etildi", tone: "error" },
  CANCELLED: { label: "Bekor qilindi", tone: "neutral" },
  FAILED: { label: "Amalga oshmadi", tone: "error" },
};

export const orderStatusMeta: Record<OrderStatus, { label: string; tone: Tone }> = {
  NEW: { label: "Yangi", tone: "neutral" },
  CONFIRMED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  SHIPPED: { label: "Jo'natildi", tone: "info" },
  DELIVERED: { label: "Yetkazildi", tone: "success" },
  COMPLETED: { label: "Yakunlangan", tone: "success" },
  CANCELLED: { label: "Bekor qilingan", tone: "neutral" },
  RETURNED: { label: "Qaytarilgan", tone: "warning" },
  REFUNDED: { label: "Pul qaytarildi", tone: "error" },
};

export const productStatusMeta: Record<ProductStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  ACTIVE: { label: "Faol", tone: "success" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

export const offerStatusMeta: Record<OfferStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  ACTIVE: { label: "Faol", tone: "success" },
  PAUSED: { label: "To'xtatilgan", tone: "warning" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

// Separate from offerStatusMeta on purpose — status is what an admin set, availability is
// computed server-side from status + startsAt/expiresAt (see OfferAvailability in @sofsavdo/types).
// An offer can show status=Faol and availability=Muddati tugagan at the same time; the UI must
// show both, not collapse them into one badge.
export const offerAvailabilityMeta: Record<NonNullable<Offer["availability"]>, { label: string; tone: Tone }> = {
  LIVE: { label: "Hozir faol", tone: "success" },
  SCHEDULED: { label: "Rejalashtirilgan", tone: "info" },
  EXPIRED: { label: "Muddati tugagan", tone: "error" },
  INACTIVE: { label: "Nofaol", tone: "neutral" },
};

export const landingStatusMeta: Record<LandingStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  PUBLISHED: { label: "E'lon qilingan", tone: "success" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

export const campaignStatusMeta: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  ACTIVE: { label: "Faol", tone: "success" },
  PAUSED: { label: "To'xtatilgan", tone: "warning" },
  COMPLETED: { label: "Yakunlangan", tone: "neutral" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

// Computed, real-mode-only — separate from campaignStatusMeta on purpose, same pattern as
// Offer's offerAvailabilityMeta.
export const campaignAvailabilityMeta: Record<NonNullable<Campaign["availability"]>, { label: string; tone: Tone }> = {
  LIVE: { label: "Hozir faol", tone: "success" },
  SCHEDULED: { label: "Rejalashtirilgan", tone: "info" },
  EXPIRED: { label: "Muddati tugagan", tone: "error" },
  INACTIVE: { label: "Nofaol", tone: "neutral" },
};

export const campaignApplicationStatusMeta: Record<CampaignApplicationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Kutilmoqda", tone: "info" }, // mock-mode legacy only
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SUBMITTED: { label: "Yuborildi", tone: "info" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  CHANGES_REQUESTED: { label: "O'zgartirish so'raldi", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
  WITHDRAWN: { label: "Bekor qilingan", tone: "neutral" },
};

export const refundStatusMeta: Record<RefundStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: "So'ralgan", tone: "neutral" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSED: { label: "Bajarildi", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
};

export const creatorAccountStatusMeta: Record<CreatorAccountStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Faol", tone: "success" },
  SUSPENDED: { label: "Vaqtincha to'xtatilgan", tone: "warning" },
  BLOCKED: { label: "Bloklangan", tone: "error" },
};

// Phase Q — bio-compliance spot-check + Premium tier (see DECISIONS.md ADR-034).
export const bioComplianceStatusMeta: Record<BioComplianceStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Tekshirilmagan", tone: "neutral" },
  COMPLIANT: { label: "Bio talabga javob beradi", tone: "success" },
  NON_COMPLIANT: { label: "Bio talabga javob bermaydi", tone: "error" },
};

export const creatorTierMeta: Record<CreatorTier, { label: string; tone: Tone }> = {
  STANDARD: { label: "Standart", tone: "neutral" },
  PREMIUM: { label: "Premium", tone: "accent" },
};

// Real Content domain (Phase 7A) — distinct from contentStatusMeta above, which stays wired to
// the legacy mock CreatorContentStatus shape.
export const realContentStatusMeta: Record<ContentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SUBMITTED: { label: "Yuborildi", tone: "info" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  CHANGES_REQUESTED: { label: "O'zgartirish so'raldi", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
  EXPIRED: { label: "Muddati tugagan", tone: "neutral" },
};

export const contentReviewActionMeta: Record<ContentReviewAction, { label: string; tone: Tone }> = {
  APPROVED: { label: "Tasdiqlandi", tone: "success" },
  REJECTED: { label: "Rad etildi", tone: "error" },
  CHANGES_REQUESTED: { label: "O'zgartirish so'raldi", tone: "warning" },
};

// Real Order domain (Phase 8) — distinct from orderStatusMeta above, which stays wired to the
// legacy mock OrderStatus shape (NEW/CONFIRMED/COMPLETED/RETURNED). See DECISIONS.md ADR-015.
export const realOrderStatusMeta: Record<RealOrderStatus, { label: string; tone: Tone }> = {
  CREATED: { label: "Yaratildi", tone: "neutral" },
  PAYMENT_PENDING: { label: "To'lov kutilmoqda", tone: "warning" },
  PAID: { label: "To'landi", tone: "success" },
  PROCESSING: { label: "Tayyorlanmoqda", tone: "info" },
  SHIPPED: { label: "Jo'natildi", tone: "info" },
  IN_TRANSIT: { label: "Yo'lda", tone: "info" },
  DELIVERED: { label: "Yetkazildi", tone: "success" },
  CANCELLED: { label: "Bekor qilindi", tone: "error" },
  REFUNDED: { label: "Qaytarildi", tone: "neutral" },
};

// Referral activity classification (6B Enhancement) — see apps/api's activity-classification.ts
// for the server-side thresholds this labels.
export const referralActivityMeta: Record<
  "NEW" | "ONBOARDING_STALLED" | "AWAITING_APPROVAL" | "APPROVED_INACTIVE" | "ACTIVE_NO_EARNINGS" | "EARNING" | "DORMANT",
  { label: string; tone: Tone }
> = {
  NEW: { label: "Yangi", tone: "neutral" },
  ONBOARDING_STALLED: { label: "Ro'yxatdan o'tish to'xtab qoldi", tone: "warning" },
  AWAITING_APPROVAL: { label: "Tasdiq kutilmoqda", tone: "info" },
  APPROVED_INACTIVE: { label: "Tasdiqlangan, faol emas", tone: "warning" },
  ACTIVE_NO_EARNINGS: { label: "Faol", tone: "info" },
  EARNING: { label: "Daromad keltirmoqda", tone: "success" },
  DORMANT: { label: "Nofaol", tone: "error" },
};

// Communication & Notification domain (Phase 10) — one label per Notification.type string.
// Mirrors apps/api's src/notifications/templates/registry.ts inApp.title copy (kept in sync by
// hand, same duplication precedent as every other status-label map in this file mirroring its
// own backend enum).
export const notificationTypeMeta: Record<string, { label: string; tone: Tone }> = {
  "campaign_application.submitted": { label: "Ariza yuborildi", tone: "info" },
  "campaign_application.approved": { label: "Ariza tasdiqlandi", tone: "success" },
  "campaign_application.rejected": { label: "Ariza rad etildi", tone: "error" },
  "campaign.joined": { label: "Kampaniyaga qo'shildingiz", tone: "success" },
  "campaign_application.new": { label: "Yangi creator arizasi", tone: "info" },
  "order.received": { label: "Yangi sotuv", tone: "success" },
  "order.delivered": { label: "Buyurtma yetkazildi", tone: "success" },
  "commission.approved": { label: "Komissiya tasdiqlandi", tone: "success" },
  "commission.payable": { label: "Komissiya to'lovga tayyor", tone: "success" },
  "payout.requested": { label: "Payout so'rovi yuborildi", tone: "info" },
  "payout.approved": { label: "Payout tasdiqlandi", tone: "success" },
  "payout.rejected": { label: "Payout rad etildi", tone: "error" },
  "payout.paid": { label: "Payout to'landi", tone: "success" },
  "payout.requested.admin": { label: "Yangi payout so'rovi", tone: "info" },
  "payout.failed.admin": { label: "Payout amalga oshmadi", tone: "error" },
  "payment.failed.admin": { label: "To'lov amalga oshmadi", tone: "error" },
  "user.registered": { label: "Xush kelibsiz", tone: "success" },
  "password_reset.requested": { label: "Parolni tiklash", tone: "info" },
};

export const notificationCategoryMeta: Record<RealNotificationCategory, { label: string }> = {
  CAMPAIGN_APPLICATION: { label: "Kampaniya arizalari" },
  ORDER: { label: "Buyurtmalar" },
  COMMISSION: { label: "Komissiyalar" },
  PAYOUT: { label: "Payoutlar" },
  ACCOUNT: { label: "Hisob" },
  ADMIN_ALERTS: { label: "Admin ogohlantirishlari" },
};

export const notificationDeliveryStatusMeta: Record<RealNotificationDeliveryStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Kutilmoqda", tone: "neutral" },
  SENT: { label: "Yuborildi", tone: "success" },
  FAILED: { label: "Amalga oshmadi", tone: "error" },
};

export const notificationChannelMeta: Record<RealNotificationChannel, { label: string }> = {
  IN_APP: { label: "Ilova ichida" },
  TELEGRAM: { label: "Telegram" },
  EMAIL: { label: "Email" },
};

export const competitionStatusMeta: Record<"DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED", { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  ACTIVE: { label: "Faol", tone: "success" },
  COMPLETED: { label: "Yakunlangan", tone: "neutral" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

export const competitionAvailabilityMeta: Record<"SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE", { label: string; tone: Tone }> = {
  LIVE: { label: "Hozir faol", tone: "success" },
  SCHEDULED: { label: "Rejalashtirilgan", tone: "info" },
  EXPIRED: { label: "Muddati tugagan", tone: "error" },
  INACTIVE: { label: "Nofaol", tone: "neutral" },
};
