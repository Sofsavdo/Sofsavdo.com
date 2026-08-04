import { BadgeCheck } from "lucide-react";
import { BRAND } from "@sofsavdo/config/brand";
import { HOMEPAGE_ICON_MAP } from "./homepage-icon-map";

export interface WhySofsavdoReason {
  icon?: string;
  title: string;
  body: string;
}

export interface WhySofsavdoContent {
  heading?: string;
  reasons?: WhySofsavdoReason[];
}

const DEFAULT_REASONS: WhySofsavdoReason[] = [
  {
    icon: "BadgeCheck",
    title: "Tekshirilgan mahsulotlar",
    body: "Har bir mahsulot sifat nazoratidan o'tadi — faqat o'zimiz sotadigan, o'zimiz javobgar bo'ladigan mahsulotlar.",
  },
  {
    icon: "ShieldCheck",
    title: "Ishonchli xarid",
    body: "Buyurtmangiz tasdiqlanguncha hech narsa to'lamaysiz — yetkazib berilganda qabul qilib olasiz.",
  },
  {
    icon: "Truck",
    title: "Tez yetkazib berish",
    body: "Buyurtmangiz belgilangan hududlarga tez va aniq yetkaziladi, holat haqida doim xabardor bo'lasiz.",
  },
];

export function WhySofsavdo({ content }: { content?: WhySofsavdoContent }) {
  const heading = content?.heading || `Nega ${BRAND.name}?`;
  const reasons = content?.reasons?.length ? content.reasons : DEFAULT_REASONS;

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <h2 className="text-center font-heading text-2xl font-bold text-text-primary md:text-3xl">{heading}</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {reasons.map(({ icon, title, body }) => {
          const Icon = (icon && HOMEPAGE_ICON_MAP[icon]) || BadgeCheck;
          return (
            <div key={title} className="rounded-card border border-border bg-surface p-6 text-center shadow-card">
              <Icon className="mx-auto h-8 w-8 text-accent" aria-hidden />
              <h3 className="mt-4 font-heading text-lg font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 font-body text-sm text-text-secondary">{body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
