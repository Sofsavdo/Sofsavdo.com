import Link from "next/link";
import { BRAND } from "@sofsavdo/config/brand";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-pad-mobile py-8 text-center font-body text-sm text-text-muted md:flex-row md:justify-between md:px-pad-desktop md:text-left">
        <span>
          &copy; {new Date().getFullYear()} {BRAND.name}
        </span>
        <nav className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/catalog" className="hover:text-text-primary">
            Katalog
          </Link>
          <Link href="/legal/terms" className="hover:text-text-primary">
            Foydalanish shartlari
          </Link>
          <Link href="/legal/privacy" className="hover:text-text-primary">
            Maxfiylik siyosati
          </Link>
          <Link href="/legal/refund-policy" className="hover:text-text-primary">
            Qaytarish siyosati
          </Link>
          <Link href="/creator/login" className="hover:text-text-primary">
            Creator kirish
          </Link>
        </nav>
      </div>
    </footer>
  );
}
