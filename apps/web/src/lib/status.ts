import type {
  CampaignApplicationStatus,
  CampaignStatus,
  CommissionStatus,
  CreatorAccountStatus,
  CreatorApplicationStatus,
  CreatorCampaignStatus,
  CreatorContentStatus,
  OfferStatus,
  OrderStatus,
  PayoutStatus,
  ProductStatus,
  RefundStatus,
} from "@rosti/types";

export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

export const applicationStatusMeta: Record<CreatorApplicationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SUBMITTED: { label: "Yuborildi", tone: "info" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  REVISION_REQUESTED: { label: "Tuzatish talab qilinadi", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
};

export const creatorCampaignStatusMeta: Record<CreatorCampaignStatus, { label: string; tone: Tone }> = {
  APPLIED: { label: "Ariza yuborildi", tone: "neutral" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
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
};

export const payoutStatusMeta: Record<PayoutStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: "So'ralgan", tone: "neutral" },
  UNDER_REVIEW: { label: "Ko'rib chiqilmoqda", tone: "info" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'landi", tone: "success" },
  REJECTED: { label: "Rad etildi", tone: "error" },
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
  EXPIRED: { label: "Muddati tugagan", tone: "error" },
  ARCHIVED: { label: "Arxivlangan", tone: "neutral" },
};

export const campaignStatusMeta: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  OPEN: { label: "Ochiq", tone: "info" },
  ACTIVE: { label: "Faol", tone: "success" },
  PAUSED: { label: "To'xtatilgan", tone: "warning" },
  COMPLETED: { label: "Yakunlangan", tone: "neutral" },
  CANCELLED: { label: "Bekor qilingan", tone: "error" },
};

export const campaignApplicationStatusMeta: Record<CampaignApplicationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Kutilmoqda", tone: "info" },
  APPROVED: { label: "Tasdiqlangan", tone: "success" },
  REJECTED: { label: "Rad etilgan", tone: "error" },
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
