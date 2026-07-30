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
  Gift,
  Bell,
  User,
  Trophy,
  Award,
  HeartHandshake,
} from "lucide-react";

export interface CreatorNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  bottomNav?: boolean;
  // Requires a fully APPROVED application (see canWorkAsCreator in lib/routing.ts) — hands out a
  // referral link or moves real money. Rendered locked (not a real link) for a creator whose
  // application is still SUBMITTED/UNDER_REVIEW, matching CreatorAppGuard's own per-route check.
  approvedOnly?: boolean;
}

// Single source of truth for both the desktop sidebar and the mobile drawer, so the two can
// never silently drift out of sync with each other.
export const CREATOR_NAV_ITEMS: CreatorNavItem[] = [
  { href: "/creator/dashboard", label: "Dashboard", icon: LayoutDashboard, bottomNav: true },
  { href: "/creator/leaderboard", label: "Reyting", icon: Trophy, approvedOnly: true },
  { href: "/creator/competitions", label: "Musobaqalar", icon: Award, approvedOnly: true },
  { href: "/creator/notifications", label: "Bildirishnomalar", icon: Bell },
  { href: "/creator/campaigns", label: "Kampaniyalar", icon: Megaphone, bottomNav: true, approvedOnly: true },
  { href: "/creator/my-campaigns", label: "Mening kampaniyalarim", icon: ListChecks, approvedOnly: true },
  { href: "/creator/content", label: "Kontentlar", icon: FileText, approvedOnly: true },
  { href: "/creator/promo-materials", label: "Promo materiallar", icon: Link2, approvedOnly: true },
  { href: "/creator/sales", label: "Sotuvlar", icon: ShoppingBag, bottomNav: true, approvedOnly: true },
  { href: "/creator/commissions", label: "Komissiyalar", icon: Percent, approvedOnly: true },
  { href: "/creator/balance", label: "Balans", icon: Wallet, bottomNav: true, approvedOnly: true },
  { href: "/creator/payouts", label: "Payout", icon: Banknote, approvedOnly: true },
  { href: "/creator/fund", label: "Creator Fund", icon: HeartHandshake, approvedOnly: true },
  { href: "/creator/referrals", label: "Do'stlarni taklif qilish", icon: Gift, approvedOnly: true },
  { href: "/creator/profile", label: "Profil", icon: User },
];
