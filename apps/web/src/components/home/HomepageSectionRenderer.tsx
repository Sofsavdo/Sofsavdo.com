import type { FeaturedOffer, HomepageSection } from "@/lib/api";
import { Hero, type HeroContent } from "./Hero";
import { WhySofsavdo, type WhySofsavdoContent } from "./WhySofsavdo";
import { FeaturedProducts } from "./FeaturedProducts";
import { Banner, type BannerContent } from "./Banner";
import { CreatorProgramBlurb, type CreatorProgramBlurbContent } from "./CreatorProgramBlurb";
import { BenefitsGrid, type BenefitsGridContent } from "./BenefitsGrid";
import { FAQ, type FaqContent } from "./FAQ";
import { SupportSection, type SupportSectionContent } from "./SupportSection";
import { CustomRichText, type CustomRichTextContent } from "./CustomRichText";

// One renderer, dispatched by `section.type` — mirrors apps/web/src/components/offer/sections.tsx's
// LandingSectionRenderer for the exact same reason: a single switch keeps type->component mapping
// in one place instead of scattered conditionals at each call site. FEATURED_PRODUCTS deliberately
// ignores section.content — its presence/order in the list is all the CMS controls; the actual
// data always comes from the already-fetched featuredOffers prop (OffersService.listFeaturedPublic
// stays the single source of truth for "trending"/curated, per DECISIONS.md ADR-027).
// CATEGORY_GRID and any future/unknown type render nothing, same as the Landing renderer's default.
export function HomepageSectionRenderer({ section, featuredOffers }: { section: HomepageSection; featuredOffers: FeaturedOffer[] }) {
  const c = section.content;
  switch (section.type) {
    case "HERO":
      return <Hero content={c as unknown as HeroContent} />;
    case "WHY_SOFSAVDO":
      return <WhySofsavdo content={c as unknown as WhySofsavdoContent} />;
    case "FEATURED_PRODUCTS":
      return <FeaturedProducts offers={featuredOffers} />;
    case "BANNER":
      return <Banner content={c as unknown as BannerContent} />;
    case "CREATOR_PROGRAM_BLURB":
      return <CreatorProgramBlurb content={c as unknown as CreatorProgramBlurbContent} />;
    case "BENEFITS":
      return <BenefitsGrid content={c as unknown as BenefitsGridContent} />;
    case "FAQ":
      return <FAQ content={c as unknown as FaqContent} />;
    case "SUPPORT":
      return <SupportSection content={c as unknown as SupportSectionContent} />;
    case "CUSTOM_RICH_TEXT":
      return <CustomRichText content={c as unknown as CustomRichTextContent} />;
    default:
      return null;
  }
}
