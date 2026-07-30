import Link from "next/link";
import { PublicHeader } from "@/components/home/PublicHeader";
import { Footer } from "@/components/home/Footer";

// Shared shell for every /legal/* page. Replaces the earlier LegalDraftPage (section-header-only
// placeholders with a "DRAFT — not legal advice" banner) now that real content has been written for
// all three pages — see each page's own file for the content itself. This is standard-form website
// legal copy grounded in what Sofsavdo's platform actually does (Click.uz + cash on delivery,
// buyer/creator accounts, real Refund/Order data), not a substitute for review by local counsel,
// but no longer an empty skeleton a real customer could land on.
export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
        <Link href="/" className="font-body text-sm text-text-secondary hover:text-text-primary">
          ← Bosh sahifaga qaytish
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-bold text-text-primary">{title}</h1>
        <p className="mt-1 font-body text-xs text-text-muted">Oxirgi yangilanish: {updatedAt}</p>
        <div className="prose-legal mt-8 space-y-6 font-body text-sm leading-relaxed text-text-secondary [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:first:mt-0 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </div>
      <Footer />
    </>
  );
}
