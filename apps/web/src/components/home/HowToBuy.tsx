import { Search, ClipboardList, CreditCard, PackageCheck } from "lucide-react";

const STEPS = [
  { icon: Search, title: "Mahsulotni tanlang", body: "Katalogdan yoki tanlangan mahsulotlardan yoqqanini toping." },
  { icon: ClipboardList, title: "Buyurtma bering", body: "Ism va telefon raqamingizni kiriting, yetkazib berish manzilini tanlang." },
  { icon: CreditCard, title: "To'lovni amalga oshiring", body: "Click orqali onlayn yoki yetkazib berishda naqd to'lang." },
  { icon: PackageCheck, title: "Qabul qilib oling", body: "Buyurtmangiz holati haqida xabardor bo'lasiz va belgilangan manzilga yetkaziladi." },
];

// Directly answers "how does a customer actually buy here" — WhySofsavdo/BenefitsGrid are trust
// badges, not a walkthrough of the actual flow, and nothing else on this page explains it end to
// end. Static/no admin-editing for now (unlike Hero/WhySofsavdo/etc, this isn't wired into
// HomepageSection's CMS types) — the steps describe the real, fixed checkout flow itself, not
// marketing copy that reasonably changes.
export function HowToBuy() {
  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <h2 className="text-center font-heading text-2xl font-bold text-text-primary md:text-3xl">
        Qanday xarid qilish mumkin?
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="relative rounded-card border border-border bg-surface p-5 text-center">
            <span className="absolute -top-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-accent font-numeric text-xs font-bold text-white">
              {i + 1}
            </span>
            <Icon className="mx-auto mt-2 size-7 text-accent" aria-hidden />
            <h3 className="mt-3 font-heading text-sm font-semibold text-text-primary">{title}</h3>
            <p className="mt-1 font-body text-xs text-text-secondary">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
