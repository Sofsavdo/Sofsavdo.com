'use client';

import { CreatorAppGuard } from "@/components/creator/CreatorAppGuard";
import { CreatorV2Navigation } from "@/components/simplified/creator-v2-navigation";
import { usePathname } from "next/navigation";

// This whole segment is per-creator, localStorage-backed mock state — there is nothing here a
// static prerender pass could usefully cache, and every page is empty until the client mounts
// and reads the session anyway.
export const dynamic = "force-dynamic";

function CreatorLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isV2Route = pathname?.startsWith('/creator/v2');

  return (
    <>
      {isV2Route && <CreatorV2Navigation />}
      {children}
    </>
  );
}

export default function CreatorAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreatorAppGuard>
      <CreatorLayoutContent>{children}</CreatorLayoutContent>
    </CreatorAppGuard>
  );
}
