"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@sofsavdo/ui";
import { useBuyerSession } from "@/services/buyerSession";
import { BuyerShell } from "./BuyerShell";

// Simpler than CreatorAppGuard: no onboarding-status branch — a buyer account has no approval
// gate, so "logged in" is the entire access check (see DECISIONS.md ADR-024).
export function BuyerAppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useBuyerSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/buyer/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
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

  return <BuyerShell>{children}</BuyerShell>;
}
