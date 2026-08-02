import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Wallet,
  Settings,
  Bell,
  BarChart3,
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

// Simplified Admin Navigation - 6 main sections only
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Asosiy",
    items: [
      { href: "/admin/products", label: "Mahsulotlar", icon: Package },
      { href: "/admin/orders", label: "Buyurtmalar", icon: ShoppingBag },
      { href: "/admin/creators", label: "Creatorlar", icon: Users },
      { href: "/admin/creator-applications", label: "Creator Arizalari", icon: Users },
      { href: "/admin/competitions", label: "Musobaqalar", icon: Trophy },
      { href: "/admin/launch-bonus", label: "Launch Bonus", icon: Gift, requiredPermission: "launch_bonus.read" },
      { href: "/admin/earnings", label: "Daromad", icon: Wallet },
      { href: "/admin/settings", label: "Sozlamalar", icon: Settings, requiredPermission: "settings.read" },
    ],
  },
  {
    label: "Tizim",
    items: [
      { href: "/admin/notifications", label: "Bildirishnomalar", icon: Bell },
      { href: "/admin/analytics", label: "Analitika", icon: BarChart3 },
    ],
  },
];

export const ADMIN_MOBILE_PRIMARY_HREFS = ["/admin/dashboard", "/admin/orders", "/admin/creators", "/admin/earnings"];
