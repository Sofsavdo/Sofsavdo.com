import Link from "next/link";
import { Button } from "@sofsavdo/ui";

export interface CreatorProgramBlurbContent {
  heading?: string;
  body?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

// Carries forward the exact pitch/CTAs the old homepage led with — now a secondary section below
// the buyer-facing Hero/FeaturedProducts, since a creator applicant is a different audience than
// a shopper landing on the same domain, not the primary one.
export function CreatorProgramBlurb({ content }: { content?: CreatorProgramBlurbContent }) {
  const heading = content?.heading || "Creator hamkorlik dasturi";
  const body = content?.body || "O'z auditoriyangizni tanlangan kampaniyalarga yo'naltiring va daromad oling.";
  const primaryCtaLabel = content?.primaryCtaLabel || "Creator sifatida qo'shilish";
  const primaryCtaHref = content?.primaryCtaHref || "/creator/register";
  const secondaryCtaLabel = content?.secondaryCtaLabel || "Kirish";
  const secondaryCtaHref = content?.secondaryCtaHref || "/creator/login";

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <div className="rounded-card border border-border bg-dark p-8 text-center text-white shadow-elevated md:p-12">
        <h2 className="font-heading text-2xl font-bold md:text-3xl">{heading}</h2>
        <p className="mx-auto mt-3 max-w-md text-balance font-body text-white/80">{body}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">
            <Link href={secondaryCtaHref}>{secondaryCtaLabel}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
