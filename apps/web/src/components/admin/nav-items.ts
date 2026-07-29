import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tag,
  LayoutTemplate,
  Megaphone,
  Users,
  ClipboardList,
  FileVideo,
  Link2,
  Ticket,
  Eye,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Percent,
  Banknote,
  BarChart3,
  UserCog,
  ShieldCheck,
  Settings,
  History,
  Gift,
  SlidersHorizontal,
  Bell,
  Home,
  Trophy,
} from "lucide-react";
import type { AdminRole } from "@sofsavdo/types";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: AdminRole;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Katalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/offers", label: "Offers", icon: Tag },
      { href: "/admin/landings", label: "Landing sahifalar", icon: LayoutTemplate },
      { href: "/admin/homepage", label: "Homepage CMS", icon: Home },
    ],
  },
  {
    label: "Kampaniyalar",
    items: [
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/admin/campaign-applications", label: "Kampaniya arizalari", icon: ClipboardList },
      { href: "/admin/competitions", label: "Musobaqalar", icon: Trophy },
    ],
  },
  {
    label: "Creatorlar",
    items: [
      { href: "/admin/creators", label: "Creatorlar", icon: Users },
      { href: "/admin/creator-applications", label: "Arizalar", icon: ClipboardList },
      { href: "/admin/content", label: "Kontent moderatsiya", icon: FileVideo },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/referral-links", label: "Referral havolalar", icon: Link2 },
      { href: "/admin/promo-codes", label: "Promo kodlar", icon: Ticket },
      { href: "/admin/visitors", label: "Visitors", icon: Eye },
      { href: "/admin/creator-referrals", label: "Creator referrallari", icon: Gift },
      { href: "/admin/referral-rules", label: "Referral qoidalari", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Savdo",
    items: [
      { href: "/admin/orders", label: "Buyurtmalar", icon: ShoppingBag },
      { href: "/admin/payments", label: "To'lovlar", icon: CreditCard },
      { href: "/admin/refunds", label: "Refundlar", icon: RotateCcw },
    ],
  },
  {
    label: "Moliya",
    items: [
      { href: "/admin/commissions", label: "Komissiyalar", icon: Percent },
      { href: "/admin/payouts", label: "Payoutlar", icon: Banknote },
    ],
  },
  {
    label: "Analitika",
    items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }],
  },
  {
    label: "Tizim",
    items: [
      { href: "/admin/notifications", label: "Bildirishnomalar", icon: Bell },
      { href: "/admin/users", label: "Foydalanuvchilar", icon: UserCog, minRole: "SUPER_ADMIN" },
      { href: "/admin/roles", label: "Rollar", icon: ShieldCheck, minRole: "SUPER_ADMIN" },
      { href: "/admin/settings", label: "Sozlamalar", icon: Settings, minRole: "SUPER_ADMIN" },
      { href: "/admin/audit-log", label: "Audit log", icon: History },
    ],
  },
];

export const ADMIN_MOBILE_PRIMARY_HREFS = ["/admin/dashboard", "/admin/orders", "/admin/campaigns", "/admin/payouts"];
