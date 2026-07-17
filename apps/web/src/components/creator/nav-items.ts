import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Megaphone,
  ListChecks,
  FileText,
  Link2,
  ShoppingBag,
  Percent,
  Wallet,
  Banknote,
} from "lucide-react";

export interface CreatorNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  bottomNav?: boolean;
}

// Single source of truth for both the desktop sidebar and the mobile drawer, so the two can
// never silently drift out of sync with each other.
export const CREATOR_NAV_ITEMS: CreatorNavItem[] = [
  { href: "/creator/dashboard", label: "Dashboard", icon: LayoutDashboard, bottomNav: true },
  { href: "/creator/campaigns", label: "Kampaniyalar", icon: Megaphone, bottomNav: true },
  { href: "/creator/my-campaigns", label: "Mening kampaniyalarim", icon: ListChecks },
  { href: "/creator/content", label: "Kontentlar", icon: FileText },
  { href: "/creator/promo-materials", label: "Promo materiallar", icon: Link2 },
  { href: "/creator/sales", label: "Sotuvlar", icon: ShoppingBag, bottomNav: true },
  { href: "/creator/commissions", label: "Komissiyalar", icon: Percent },
  { href: "/creator/balance", label: "Balans", icon: Wallet, bottomNav: true },
  { href: "/creator/payouts", label: "Payout", icon: Banknote },
];
