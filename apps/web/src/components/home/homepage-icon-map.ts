import { BadgeCheck, ShieldCheck, Truck, CreditCard, PackageCheck, RotateCcw, Headset, type LucideIcon } from "lucide-react";

// CMS content is JSON, so an icon can only be referenced by a string key, not a React component —
// this is the lookup used by both WhySofsavdo and BenefitsGrid (the only two homepage sections
// with per-item icons) to turn an admin-entered key back into a real Lucide icon. Unknown/missing
// keys fall back to BadgeCheck rather than crashing (see each component's own usage).
export const HOMEPAGE_ICON_MAP: Record<string, LucideIcon> = {
  BadgeCheck,
  ShieldCheck,
  Truck,
  CreditCard,
  PackageCheck,
  RotateCcw,
  Headset,
};
