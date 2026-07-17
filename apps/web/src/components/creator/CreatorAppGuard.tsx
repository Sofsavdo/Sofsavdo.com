"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@rosti/ui";
import { useSession } from "@/services/session";
import { canAccessApprovedOnlyRoutes } from "@/lib/routing";
import { CreatorShell } from "./CreatorShell";

// Guards every /creator/(app)/* route (dashboard, campaigns, my-campaigns, content,
// promo-materials, sales, commissions, balance, payouts) behind an APPROVED application.
// An applicant who types the URL directly is bounced to /creator/onboarding, which itself
// explains why (see that page's status screens) — never a silent blank page.
export function CreatorAppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/creator/login");
      return;
    }
    if (!canAccessApprovedOnlyRoutes(user.application.status)) {
      router.replace("/creator/onboarding");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !canAccessApprovedOnlyRoutes(user.application.status)) {
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
