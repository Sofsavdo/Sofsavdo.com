import Link from "next/link";
import { Button } from "@sofsavdo/ui";

export interface BannerContent {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// New section type (Phase H) — no default rows use this, and no default copy: an empty/misconfigured
// BANNER section renders nothing rather than a placeholder, matching this codebase's own convention
// against shipping fabricated content (see docs/PROHIBITED.md). Intended for admin-authored seasonal
// campaigns/announcements, scheduled via the section's own startsAt/expiresAt (see ADR-027).
export function Banner({ content }: { content?: BannerContent }) {
  if (!content?.title) return null;

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-6 md:px-pad-desktop">
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-card md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="font-heading text-xl font-bold text-text-primary">{content.title}</h2>
          {content.body ? <p className="mt-1 font-body text-sm text-text-secondary">{content.body}</p> : null}
        </div>
        {content.ctaLabel && content.ctaHref ? (
          <Button asChild>
            <Link href={content.ctaHref}>{content.ctaLabel}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
