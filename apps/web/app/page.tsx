import Link from "next/link";
import { Button } from "@rosti/ui";

// Minimal corporate root page (spec §7 / ARCHITECTURE.md route map): brand, creator-program CTA,
// login, support. Deliberately not a marketplace/catalog homepage — there is nothing here for a
// buyer to browse, and no link exists from this page to any offer, product, or course listing.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-page flex-col items-center justify-center gap-8 px-pad-mobile text-center md:px-pad-desktop">
      <div className="space-y-3">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">Rosti</h1>
        <p className="max-w-md text-balance font-body text-text-secondary">
          Creator hamkorlik dasturi — o&apos;z auditoriyangizni tanlangan kampaniyalarga
          yo&apos;naltiring va daromad oling.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/creator/register">Creator sifatida qo&apos;shilish</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/creator/login">Kirish</Link>
        </Button>
      </div>
      <Link href="/support" className="font-body text-sm text-text-muted underline">
        Yordam kerakmi?
      </Link>
    </main>
  );
}
