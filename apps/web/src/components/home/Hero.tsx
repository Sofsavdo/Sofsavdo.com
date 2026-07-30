import Link from "next/link";
import { Button } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";

export interface HeroContent {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// Buyer-facing, not creator-facing (the creator pitch gets its own CreatorProgramBlurb section
// further down) — the Sofsavdo pivot's Commerce Home is a shopping destination first. Default CTA
// links to /catalog (the definitive "browse everything" page) rather than scrolling to this same
// page's own FeaturedProducts section — that anchor was a dead end whenever no offer is marked
// featured yet (a real launch-week state: FeaturedProducts then renders its own "hozircha yo'q"
// placeholder with nothing to scroll to). An admin-edited ctaHref (Phase H) is the intended way to
// point Hero somewhere else once there's a good reason to.
export function Hero({ content }: { content?: HeroContent }) {
  const title = content?.title || BRAND.name;
  const subtitle = content?.subtitle || "Tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish — bir joyda.";
  const ctaLabel = content?.ctaLabel || "Mahsulotlarni ko'rish";
  const ctaHref = content?.ctaHref || "/catalog";

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile pb-12 pt-16 text-center md:px-pad-desktop md:pb-20 md:pt-24">
      <h1 className="font-heading text-4xl font-bold tracking-tight text-text-primary md:text-6xl">{title}</h1>
      <p className="mx-auto mt-5 max-w-xl text-balance font-body text-lg text-text-secondary md:text-xl">{subtitle}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
