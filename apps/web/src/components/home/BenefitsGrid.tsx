import { CreditCard } from "lucide-react";
import { HOMEPAGE_ICON_MAP } from "./homepage-icon-map";

export interface BenefitItem {
  icon?: string;
  label: string;
}

export interface BenefitsGridContent {
  items?: BenefitItem[];
}

// "Tezkor" (responsive), not "24/7" — only email support exists today (see LEGAL.md's Support
// contact info note), so a round-the-clock claim would over-promise what a real customer gets.
const DEFAULT_BENEFITS: BenefitItem[] = [
  { icon: "CreditCard", label: "Click va naqd to'lov" },
  { icon: "PackageCheck", label: "Original mahsulotlar" },
  { icon: "RotateCcw", label: "Oson qaytarish" },
  { icon: "Headset", label: "Tezkor qo'llab-quvvatlash" },
];

export function BenefitsGrid({ content }: { content?: BenefitsGridContent }) {
  const items = content?.items?.length ? content.items : DEFAULT_BENEFITS;

  return (
    <section className="mx-auto max-w-7xl px-pad-mobile py-10 md:px-pad-desktop md:py-16">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {items.map(({ icon, label }) => {
          const Icon = (icon && HOMEPAGE_ICON_MAP[icon]) || CreditCard;
          return (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <Icon className="h-7 w-7 text-accent" aria-hidden />
              <span className="font-body text-sm font-medium text-text-primary">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
