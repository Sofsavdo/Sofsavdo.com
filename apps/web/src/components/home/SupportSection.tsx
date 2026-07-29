import { BRAND } from "@sofsavdo/config/brand";

export interface SupportSectionContent {
  heading?: string;
  body?: string;
}

// No link to `/support` — the old homepage linked there, but that route has never existed (only
// /legal/terms, /legal/privacy, /legal/refund-policy do). Fixed here by surfacing the real contact
// channel directly instead of carrying the dead link forward into the new page. The email itself
// is deliberately NOT CMS-editable — it's a brand constant (BRAND.supportEmail), not page content.
export function SupportSection({ content }: { content?: SupportSectionContent }) {
  const heading = content?.heading || "Yordam kerakmi?";
  const body = content?.body || "Savollaringiz bo'lsa, biz bilan bog'laning.";

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-10 text-center md:px-pad-desktop md:py-16">
      <h2 className="font-heading text-2xl font-bold text-text-primary md:text-3xl">{heading}</h2>
      <p className="mx-auto mt-3 max-w-md text-balance font-body text-text-secondary">{body}</p>
      <a href={`mailto:${BRAND.supportEmail}`} className="mt-4 inline-block font-body font-medium text-accent underline">
        {BRAND.supportEmail}
      </a>
    </section>
  );
}
