import Link from "next/link";
import { Button } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";

// Shared, minimal top bar for the two "browse the shop" hub pages (home, /catalog) — before this,
// neither page had any way to reach the other except the homepage's one footer link, and /catalog
// had no way back to / at all except the browser's back button. Deliberately NOT used on the offer
// landing page (/o/[offerSlug]) or checkout — those are intentionally distraction-free single-offer
// funnel pages a creator shares directly, where pulling attention away from the one buy CTA would
// hurt conversion, not help it (see that page's own file comment).
export function PublicHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-pad-mobile py-4 md:px-pad-desktop">
        <Link href="/" className="font-heading text-xl font-bold text-text-primary">
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/catalog" className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
            Katalog
          </Link>
          {/* A creator's own entry point previously existed only as one small link buried in the
              footer — creators had to scroll all the way down and hunt for it. Moved to the top
              nav, visible on both pages this header renders on. Links to /creator/register (the
              actual sign-up entry point) rather than /creator/login, matching this button's
              inviting "join us" framing — an existing creator can still reach login in one more
              click from the register page's own "Hisobingiz bormi?" link. */}
          <Link href="/creator/register" className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
            Hamkorlik uchun
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/buyer/login">Kirish</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
