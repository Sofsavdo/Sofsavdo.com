import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(3, "Nomini kiriting"),
  slug: z.string().min(3, "Slug kiriting").regex(/^[a-z0-9-]+$/, "Faqat kichik harf, raqam va tire"),
  type: z.enum(["PHYSICAL_PRODUCT", "DIGITAL_PRODUCT", "COURSE", "SERVICE", "CONSULTATION"]),
  shortDescription: z.string().optional(),
  sku: z.string().optional(),
  costPriceMinor: z.string().optional(),
  internalNotes: z.string().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const offerSchema = z.object({
  productId: z.string().min(1, "Product tanlang"),
  name: z.string().min(3, "Nomini kiriting"),
  slug: z.string().min(3, "Slug kiriting").regex(/^[a-z0-9-]+$/, "Faqat kichik harf, raqam va tire"),
  headline: z.string().min(5, "Headline kiriting"),
  subheadline: z.string().min(5, "Subheadline kiriting"),
  priceMinor: z.string().min(1, "Narxni kiriting"),
  compareAtPriceMinor: z.string().optional(),
  currency: z.string().min(1),
  ctaType: z.enum(["BUY_NOW", "ORDER_FORM", "APPLY_NOW", "BOOK_CALL", "PAY_INSTALLMENT"]),
  ctaLabel: z.string().min(2, "CTA matnini kiriting"),
  deliveryInfo: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const campaignSchema = z.object({
  offerId: z.string().min(1, "Offer tanlang"),
  name: z.string().min(3, "Nomini kiriting"),
  slug: z.string().min(3, "Slug kiriting").regex(/^[a-z0-9-]+$/, "Faqat kichik harf, raqam va tire"),
  category: z.string().min(2, "Kategoriya kiriting"),
  description: z.string().min(10, "Tavsif kiriting"),
  goal: z.string().min(5, "Maqsad kiriting"),
  targetAudience: z.string().min(5, "Auditoriya kiriting"),
  ctaLabel: z.string().min(2, "CTA kiriting"),
  applicationDeadline: z.string().min(1, "Muddatni tanlang"),
  creatorLimit: z.string().min(1, "Limitni kiriting"),
  commissionType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  commissionValue: z.string().min(1, "Qiymatni kiriting"),
  barterEnabled: z.boolean(),
  freeProduct: z.string().optional(),
  attributionWindowDays: z.string().min(1, "Kunni kiriting"),
  requiresApproval: z.boolean(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const payoutDecisionSchema = z.object({
  referenceNumber: z.string().min(3, "Tranzaksiya raqamini kiriting"),
});
export type PayoutDecisionInput = z.infer<typeof payoutDecisionSchema>;
