import Link from "next/link";
import { BRAND } from "@sofsavdo/config/brand";

// These pages read session state on mount to redirect an already-logged-in creator onward —
// nothing worth statically prerendering.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-pad-mobile py-12 md:px-pad-desktop">
      <Link href="/" className="mb-8 font-heading text-2xl font-bold text-text-primary">
        {BRAND.name}
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
