import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Wallet,
  Bell,
  User,
  Trophy,
  HeartHandshake,
  Gift,
  Layers,
  TrendingUp,
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
  { href: "/creator/streams", label: "Oqimlar", icon: Layers, bottomNav: true, approvedOnly: true },
  { href: "/creator/my-streams", label: "Mening oqimlarim", icon: TrendingUp, approvedOnly: true },
  { href: "/creator/earnings", label: "Daromad", icon: Wallet, bottomNav: true, approvedOnly: true },
  { href: "/creator/leaderboard", label: "Reyting", icon: Trophy, approvedOnly: true },
  { href: "/creator/fund", label: "Jamg'arma", icon: HeartHandshake, approvedOnly: true },
  { href: "/creator/referrals", label: "Do'stlarni taklif qilish", icon: Gift, approvedOnly: true },
  { href: "/creator/notifications", label: "Bildirishnomalar", icon: Bell },
  { href: "/creator/profile", label: "Profil", icon: User },
];
