import type { HomepageSectionType } from "@/lib/api/admin";

export const HOMEPAGE_SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HERO: "Hero",
  WHY_SOFSAVDO: "Nega biz?",
  FEATURED_PRODUCTS: "Tanlangan mahsulotlar",
  BANNER: "Banner",
  CREATOR_PROGRAM_BLURB: "Creator dasturi bloki",
  BENEFITS: "Afzalliklar",
  FAQ: "Ko'p so'raladigan savollar",
  SUPPORT: "Yordam bo'limi",
  CUSTOM_RICH_TEXT: "Erkin matn",
  CATEGORY_GRID: "Kategoriya to'ri (hali mavjud emas)",
};

// FEATURED_PRODUCTS/CATEGORY_GRID have no admin-editable content — the former always delegates to
// OffersService.listFeaturedPublic (see DECISIONS.md ADR-027), the latter ships inert pending
// Phase E's own Category model.
export const HOMEPAGE_SECTION_HAS_EDITOR: Record<HomepageSectionType, boolean> = {
  HERO: true,
  WHY_SOFSAVDO: true,
  FEATURED_PRODUCTS: false,
  BANNER: true,
  CREATOR_PROGRAM_BLURB: true,
  BENEFITS: true,
  FAQ: true,
  SUPPORT: true,
  CUSTOM_RICH_TEXT: true,
  CATEGORY_GRID: false,
};

export const ALL_HOMEPAGE_SECTION_TYPES = Object.keys(HOMEPAGE_SECTION_TYPE_LABELS) as HomepageSectionType[];
