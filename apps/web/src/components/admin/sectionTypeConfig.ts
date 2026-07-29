import type { LandingSectionType } from "@sofsavdo/types";

export type SectionContentShape = "none" | "text" | "items" | "steps" | "reviews" | "faq" | "images" | "caption";

export const SECTION_TYPE_LABELS: Record<LandingSectionType, string> = {
  HERO: "Hero",
  PROBLEM: "Muammo",
  SOLUTION: "Yechim",
  BENEFITS: "Foydalar",
  HOW_IT_WORKS: "Qanday ishlaydi",
  AUDIENCE: "Kim uchun",
  NOT_FOR: "Kim uchun emas",
  CREATOR_VIDEO: "Creator videosi",
  PRODUCT_GALLERY: "Mahsulot galereyasi",
  PRICING: "Narx",
  OFFER_VARIANTS: "Offer variantlari",
  BONUSES: "Bonuslar",
  REVIEWS: "Sharhlar",
  GUARANTEE: "Kafolat",
  TERMS: "Shartlar / Ogohlantirish",
  DELIVERY: "Yetkazib berish",
  PAYMENT: "To'lov",
  FAQ: "Ko'p so'raladigan savollar",
  FINAL_CTA: "Yakuniy CTA",
  CUSTOM_RICH_TEXT: "Erkin matn",
};

export const SECTION_TYPE_SHAPE: Record<LandingSectionType, SectionContentShape> = {
  HERO: "none",
  PROBLEM: "text",
  SOLUTION: "text",
  BENEFITS: "items",
  HOW_IT_WORKS: "steps",
  AUDIENCE: "text",
  NOT_FOR: "text",
  CREATOR_VIDEO: "caption",
  PRODUCT_GALLERY: "images",
  PRICING: "none",
  OFFER_VARIANTS: "none",
  BONUSES: "items",
  REVIEWS: "reviews",
  GUARANTEE: "text",
  TERMS: "text",
  DELIVERY: "text",
  PAYMENT: "none",
  FAQ: "faq",
  FINAL_CTA: "none",
  CUSTOM_RICH_TEXT: "text",
};

export const ALL_SECTION_TYPES = Object.keys(SECTION_TYPE_LABELS) as LandingSectionType[];
