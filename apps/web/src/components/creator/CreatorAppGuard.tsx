"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Skeleton } from "@sofsavdo/ui";
import { useSession } from "@/services/session";
import { canEnterCabinet, canWorkAsCreator } from "@/lib/routing";
import { CreatorShell } from "./CreatorShell";

// Routes reachable by any creator who can enter the cabinet at all (SUBMITTED/UNDER_REVIEW/
// APPROVED — see canEnterCabinet), even before admin approval. Every other /creator/(app)/* route
// either hands out a referral link or moves real money, so it stays behind canWorkAsCreator
// (APPROVED only) — see CREATOR_NAV_ITEMS' approvedOnly flag for the matching sidebar treatment.
const ALWAYS_ALLOWED_PREFIXES = ["/creator/dashboard", "/creator/profile", "/creator/notifications", "/creator/notification-preferences"];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

// Guards every /creator/(app)/* route. A creator who hasn't finished onboarding yet (DRAFT/
// CHANGES_REQUESTED/REJECTED — nothing to show inside the cabinet until they act on the wizard) is
// bounced to /creator/onboarding, which itself explains why. A creator who HAS submitted
// (SUBMITTED/UNDER_REVIEW/APPROVED) enters the real cabinet — dashboard/profile/notifications are
// always reachable; direct navigation to an earning-capable route (referrals, campaigns, content,
// sales, commissions, balance, payouts, fund, leaderboard, competitions, promo-materials,
// my-campaigns) while still pending bounces back to the dashboard, where the pending state is
// explained and the same set of features is visibly locked in the sidebar — never a silent blank
// page or a raw 403 from the API.
export function CreatorAppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/creator/login");
      return;
    }
    if (!canEnterCabinet(user.application.status)) {
      router.replace("/creator/onboarding");
      return;
    }
    if (!canWorkAsCreator(user.application.status) && !isAlwaysAllowed(pathname)) {
      router.replace("/creator/dashboard");
    }
  }, [isLoading, user, pathname, router]);

  const blocked =
    isLoading ||
    !user ||
    !canEnterCabinet(user.application.status) ||
    (!canWorkAsCreator(user.application.status) && !isAlwaysAllowed(pathname));

  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-pad-mobile">
        <div className="w-full max-w-page space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return <CreatorShell>{children}</CreatorShell>;
}
