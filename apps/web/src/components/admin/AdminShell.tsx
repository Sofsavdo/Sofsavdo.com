"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, FlaskConical } from "lucide-react";
import { cn } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";
import type { AdminRole } from "@sofsavdo/types";
import { useAdminSession } from "@/services/adminSession";
import { useNotifications } from "@/services/notifications";
import { ROLE_LABELS } from "@/lib/adminRouting";
import { ADMIN_NAV_GROUPS, ADMIN_MOBILE_PRIMARY_HREFS } from "./nav-items";

const DEV_ROLES: AdminRole[] = ["MANAGER", "ADMIN", "SUPER_ADMIN"];
const isDev = process.env.NODE_ENV !== "production";

function NavLink({ href, label, icon: Icon, active, badge, onClick }: {
  href: string;
  label: string;
  icon: (typeof ADMIN_NAV_GROUPS)[number]["items"][number]["icon"];
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-input px-3 py-2 font-body text-sm transition-colors",
        active ? "bg-accent/10 font-medium text-accent" : "text-text-secondary hover:bg-bg hover:text-text-primary",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-numeric text-[11px] font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, devSwitchRole } = useAdminSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The one signal that a new creator/campaign application (or any other admin alert) actually
  // arrived — before this, the "Bildirishnomalar" nav item was a plain link with zero indication
  // anything was waiting, so a real submission could sit unnoticed indefinitely. IN_APP-only, same
  // reasoning as the buyer notifications page: EMAIL/TELEGRAM delivery bookkeeping isn't a "did
  // something happen" signal for the person reading this sidebar.
  const unreadQuery = useNotifications({ channel: "IN_APP", unreadOnly: true, pageSize: 1 });
  const unreadCount = unreadQuery.data?.total ?? 0;

  const visibleGroups = ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.requiredPermission || (user?.permissions.includes(item.requiredPermission) ?? false)),
  })).filter((g) => g.items.length > 0);

  const mobilePrimary = visibleGroups.flatMap((g) => g.items).filter((i) => ADMIN_MOBILE_PRIMARY_HREFS.includes(i.href));

  const sidebarContent = (
    <>
      <div>
        <Link href="/admin/dashboard" className="mb-6 block font-heading text-xl font-bold text-text-primary">
          {BRAND.name} Admin
        </Link>
        <nav className="flex flex-col gap-4">
          {visibleGroups.map((group) => (
            <div key={group.label || "root"}>
              {group.label ? (
                <p className="mb-1.5 px-3 font-body text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {group.label}
                </p>
              ) : null}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={pathname.startsWith(item.href)}
                    badge={item.href === "/admin/notifications" ? unreadCount : undefined}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-border pt-4">
        {isDev ? (
          <div className="mb-3 rounded-input border border-dashed border-border p-2.5">
            <p className="mb-1.5 flex items-center gap-1 font-body text-[11px] font-medium text-text-muted">
              <FlaskConical className="size-3" /> Dev: rolni almashtirish
            </p>
            <div className="flex gap-1">
              {DEV_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => devSwitchRole(role)}
                  className={cn(
                    "flex-1 rounded-input border px-1.5 py-1 font-body text-[11px]",
                    user?.role === role ? "border-accent text-accent" : "border-border text-text-secondary",
                  )}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-sm text-text-primary">{user?.displayName}</p>
            <p className="font-body text-xs text-text-muted">{user ? ROLE_LABELS[user.role] : ""}</p>
          </div>
          <button type="button" onClick={logout} aria-label="Chiqish" className="rounded-input p-2 text-text-muted hover:bg-bg hover:text-error">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg md:flex">
      <aside className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-surface px-4 py-6 md:flex">
        {sidebarContent}
      </aside>

      <header className="flex items-center justify-between border-b border-border bg-surface px-pad-mobile py-3 md:hidden">
        <Link href="/admin/dashboard" className="font-heading text-lg font-bold text-text-primary">
          {BRAND.name} Admin
        </Link>
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Menyuni ochish" className="rounded-input p-2 text-text-primary hover:bg-bg">
          <Menu className="size-5" />
        </button>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-dark/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto flex h-full w-80 flex-col justify-between overflow-y-auto bg-surface px-4 py-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-lg font-bold text-text-primary">Menyu</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Yopish" className="rounded-input p-2 text-text-muted hover:bg-bg">
                <X className="size-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      ) : null}

      <main className="flex-1 px-pad-mobile py-6 pb-24 md:px-pad-desktop md:py-8 md:pb-8">
        <div className="mx-auto max-w-page">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden">
        {mobilePrimary.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 font-body text-[11px]", active ? "text-accent" : "text-text-muted")}>
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
