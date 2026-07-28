import Link from "next/link";

// Shared shell for every /legal/* page — Phase 14 §16 legal audit. These are structural
// placeholders (section headers only), never invented clause text, so nobody mistakes a draft for
// reviewed legal language. See LEGAL.md for the full list of what needs real local counsel review
// before launch.
export function LegalDraftPage({ title, sections }: { title: string; sections: string[] }) {
  return (
    <div className="mx-auto max-w-2xl px-pad-mobile py-10 md:px-pad-desktop">
      <Link href="/" className="font-body text-sm text-text-secondary hover:text-text-primary">
        ← Bosh sahifaga qaytish
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-bold text-text-primary">{title}</h1>
      <div className="mt-4 rounded-input border border-dashed border-error bg-error/5 p-4 font-body text-sm text-error">
        <strong>QORALAMA — DRAFT.</strong> Bu sahifa hali yuridik maslahat sifatida ko&apos;rib
        chiqilmagan. Haqiqiy ishga tushirishdan oldin mahalliy yurist tomonidan tasdiqlanishi shart.
        <br />
        <em>Draft only — not reviewed as legal advice. Must be confirmed by local legal counsel before real launch.</em>
      </div>
      <div className="mt-6 space-y-6 font-body text-sm text-text-secondary">
        {sections.map((section) => (
          <div key={section}>
            <h2 className="mb-1.5 font-heading text-base font-semibold text-text-primary">{section}</h2>
            <p className="italic text-text-muted">To&apos;ldirilishi kerak — mahalliy qonunchilikka mos ravishda yurist tomonidan yozilishi kerak.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
