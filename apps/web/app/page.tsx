import type { Metadata } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import { getFeaturedOffers, getHomepageSections, getRecentActivity } from "@/lib/api";
import { PublicHeader } from "@/components/home/PublicHeader";
import { RecentActivityTicker } from "@/components/home/RecentActivityTicker";
import { Hero } from "@/components/home/Hero";
import { WhySofsavdo } from "@/components/home/WhySofsavdo";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HowToBuy } from "@/components/home/HowToBuy";
import { CreatorProgramBlurb } from "@/components/home/CreatorProgramBlurb";
import { BenefitsGrid } from "@/components/home/BenefitsGrid";
import { FAQ } from "@/components/home/FAQ";
import { SupportSection } from "@/components/home/SupportSection";
import { Footer } from "@/components/home/Footer";
import { HomepageSectionRenderer } from "@/components/home/HomepageSectionRenderer";

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name} — tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish.`,
};

// Non-personalized and safe to cache briefly — this page never reads a cookie or any per-visitor
// state, unlike /o/[offerSlug] (force-dynamic there for its per-request `?ref=` attribution).
export const revalidate = 60;

// Premium Commerce Home (Sofsavdo pivot, Phase C), now CMS-driven (Phase H — see DECISIONS.md
// ADR-027). Deliberately still NOT a catalog itself: FeaturedProducts loads only a small,
// server-capped set of offers (OffersService.listFeaturedPublic, FEATURED_OFFERS_LIMIT), never the
// full product list — the full, paginated list lives at /catalog (Phase E), reachable from this
// page only via the Footer's one deliberate link. A plain Server Component, not a client-fetched
// dashboard: everything below renders from data already available at request time, with zero
// client-side `useQuery` — see docs/PROHIBITED.md for what this page still deliberately does not do.
//
// GET /homepage returning zero rows (a fresh/unconfigured environment, or the backend being
// unreachable — same defensive `.catch(() => [])` pattern as /catalog) falls back to exactly the
// original fixed Phase C composition below, so there is never a visually empty homepage and no
// risky pre-seeded data migration was needed to ship this feature (see the Phase H migration's own
// comment). Once an admin has added at least one HomepageSection row, every section (including
// which of these seven appear, and in what order) is driven by that data instead.
export default async function HomePage() {
  const [featuredOffers, sections, recentActivity] = await Promise.all([
    getFeaturedOffers().catch(() => []),
    getHomepageSections().catch(() => []),
    getRecentActivity().catch(() => []),
  ]);

  if (sections.length === 0) {
    return (
      <main>
        <PublicHeader />
        <RecentActivityTicker events={recentActivity} />
        <Hero />
        <WhySofsavdo />
        <FeaturedProducts offers={featuredOffers} />
        <HowToBuy />
        <CreatorProgramBlurb />
        <BenefitsGrid />
        <FAQ />
        <SupportSection />
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <PublicHeader />
      <RecentActivityTicker events={recentActivity} />
      {sections.map((section) => (
        <HomepageSectionRenderer key={`${section.type}-${section.sortOrder}`} section={section} featuredOffers={featuredOffers} />
      ))}
      {/* Not yet a real HomepageSection type (see HowToBuy's own comment) — always rendered here
          so an admin-configured section list never silently drops the one thing on this page that
          explains the actual purchase flow. */}
      <HowToBuy />
      <Footer />
    </main>
  );
}
