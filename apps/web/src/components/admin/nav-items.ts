import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  UserPlus,
  Wallet,
  Settings,
  Trophy,
  Gift,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // The real permission key required to see this item — checked against AdminUser.permissions
  // (AdminShell.tsx), not the coarse role-tier label. See DECISIONS.md's Roles/RBAC ADR: gating
  // this on a role tier silently hid these pages from any custom role, no matter what it was
  // actually granted.
  requiredPermission?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

// Simplified Admin Navigation - Only essential sections
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "", items: [{ href: "/admin/dashboard", label: "Bosh sahifa", icon: LayoutDashboard }] },
  {
    label: "Asosiy",
    items: [
      { href: "/admin/products", label: "Mahsulotlar", icon: Package },
      { href: "/admin/orders", label: "Buyurtmalar", icon: ShoppingBag },
      { href: "/admin/creators", label: "Creatorlar", icon: Users },
      { href: "/admin/creator-applications", label: "Creator Arizalari", icon: Users },
      // Fully built (list + detail + disqualify, backed by GET /admin/creator-referrals) but never
      // linked anywhere in the admin nav — a creator-referred-a-creator "who brought whom" chain,
      // already excluding organic/no-referral signups by construction (every row here has a real
      // referrer). Was effectively undiscoverable until now.
      { href: "/admin/creator-referrals", label: "Referral zanjiri", icon: UserPlus, requiredPermission: "referral.read" },
      { href: "/admin/launch-bonus", label: "Bonus", icon: Gift, requiredPermission: "launch_bonus.read" },
      { href: "/admin/competitions", label: "Musobaqalar", icon: Trophy },
      { href: "/admin/commissions", label: "Daromad", icon: Wallet, requiredPermission: "commission.read" },
      { href: "/admin/payouts", label: "Payout So'rovlari", icon: Wallet, requiredPermission: "payout.read" },
      { href: "/admin/settings", label: "Sozlamalar", icon: Settings, requiredPermission: "settings.read" },
    ],
  },
];

export const ADMIN_MOBILE_PRIMARY_HREFS = ["/admin/dashboard", "/admin/orders", "/admin/creators", "/admin/launch-bonus"];
