import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Package, ShoppingBag, CreditCard, Heart, MapPin, User, Bell, Headset } from "lucide-react";

export interface BuyerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  bottomNav?: boolean;
}

// Same single-source-of-truth convention as creator/nav-items.ts. "Promo Codes" from the original
// vision is deliberately not here yet — no backend exists for "which promo codes has this buyer
// used" (PromoCode tracks codes per-campaign, not per-buyer usage history), and this codebase's
// own convention (docs/PROHIBITED.md) is to never ship a page backed by fabricated data. Tracked
// as a disclosed gap, not silently dropped.
export const BUYER_NAV_ITEMS: BuyerNavItem[] = [
  { href: "/buyer/dashboard", label: "Bosh sahifa", icon: LayoutDashboard, bottomNav: true },
  { href: "/buyer/orders", label: "Buyurtmalar", icon: Package, bottomNav: true },
  { href: "/buyer/purchases", label: "Xarid qilingan mahsulotlar", icon: ShoppingBag },
  { href: "/buyer/payments", label: "To'lovlar tarixi", icon: CreditCard },
  { href: "/buyer/saved", label: "Saqlangan mahsulotlar", icon: Heart, bottomNav: true },
  { href: "/buyer/addresses", label: "Manzillar", icon: MapPin },
  { href: "/buyer/notifications", label: "Bildirishnomalar", icon: Bell },
  { href: "/buyer/profile", label: "Profil", icon: User, bottomNav: true },
  { href: "/buyer/support", label: "Yordam", icon: Headset },
];
