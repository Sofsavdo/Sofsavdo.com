"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";
import { useSession } from "@/services/session";
import { CREATOR_NAV_ITEMS } from "./nav-items";

function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string;
  label: string;
  icon: (typeof CREATOR_NAV_ITEMS)[number]["icon"];
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-input px-3 py-2 font-body text-sm transition-colors",
        active ? "bg-accent/10 text-accent font-medium" : "text-text-secondary hover:bg-bg hover:text-text-primary",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function CreatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomItems = CREATOR_NAV_ITEMS.filter((i) => i.bottomNav);

  return (
    <div className="min-h-screen bg-bg md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface px-4 py-6 md:flex md:flex-col md:justify-between">
        <div>
          <Link href="/creator/dashboard" className="mb-8 block font-heading text-xl font-bold text-text-primary">
            {BRAND.name}
          </Link>
          <nav className="flex flex-col gap-1">
            {CREATOR_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
          </nav>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent/10 font-numeric text-xs font-semibold text-accent">
              {user?.avatarInitials}
            </span>
            <span className="font-body text-sm text-text-primary">{user?.displayName}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Chiqish"
            className="rounded-input p-2 text-text-muted hover:bg-bg hover:text-error"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-pad-mobile py-3 md:hidden">
        <Link href="/creator/dashboard" className="font-heading text-lg font-bold text-text-primary">
          {BRAND.name}
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menyuni ochish"
          className="rounded-input p-2 text-text-primary hover:bg-bg"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile full nav drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-dark/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto flex h-full w-72 flex-col justify-between bg-surface px-4 py-6">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <span className="font-heading text-lg font-bold text-text-primary">Menyu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Yopish"
                  className="rounded-input p-2 text-text-muted hover:bg-bg"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {CREATOR_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={pathname.startsWith(item.href)}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
              </nav>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-input px-3 py-2 font-body text-sm text-error hover:bg-error/5"
            >
              <LogOut className="size-4" /> Chiqish
            </button>
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main className="flex-1 px-pad-mobile py-6 pb-24 md:px-pad-desktop md:py-8 md:pb-8">
        <div className="mx-auto max-w-page">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden">
        {bottomItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 font-body text-[11px]",
                active ? "text-accent" : "text-text-muted",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
