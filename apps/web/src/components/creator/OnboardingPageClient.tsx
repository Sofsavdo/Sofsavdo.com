"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";
import { useSession } from "@/services/session";
import { canEnterCabinet } from "@/lib/routing";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingPageClient() {
  const router = useRouter();
  const { user, isLoading, logout } = useSession();

  // A SUBMITTED/UNDER_REVIEW creator has nothing left to do here (see canEnterCabinet) — they used
  // to get stuck on this bare, chrome-less "under review" card with no sidebar and no way to reach
  // Profile/Notifications, right after finishing the one thing (submitting) that should have let
  // them into their account. /creator/dashboard already renders the exact same pending state
  // (PendingDashboard) inside the real cabinet shell, so send them there instead.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/creator/login");
      return;
    }
    if (canEnterCabinet(user.application.status)) {
      router.replace("/creator/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-2xl px-pad-mobile py-12 md:px-pad-desktop">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  const { application } = user;

  if (canEnterCabinet(application.status)) return null; // redirecting

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-2xl px-pad-mobile py-12 md:px-pad-desktop">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="font-heading text-xl font-bold text-text-primary">
          {BRAND.name}
        </Link>
        <button type="button" onClick={logout} className="font-body text-sm text-text-muted underline">
          Chiqish
        </button>
      </div>
      {children}
    </div>
  );

  // DRAFT, CHANGES_REQUESTED, or REJECTED — all editable (SUBMITTED/UNDER_REVIEW never reach here,
  // see the redirect above). Unlike CampaignApplication, REJECTED is
  // not terminal here: a rejected applicant can address the stated reason and resubmit rather than
  // being permanently locked out (see DECISIONS.md ADR-018). "submit" (DRAFT's first-ever
  // submission) and "resubmit" (from CHANGES_REQUESTED/REJECTED) are distinct real-backend actions
  // — see OnboardingWizard's `mode` prop.
  return shell(
    <OnboardingWizard
      initialData={application.data}
      initialStep={application.currentStep || 1}
      revisionNote={application.status !== "DRAFT" ? application.reviewNote : undefined}
      mode={application.status === "DRAFT" ? "submit" : "resubmit"}
      applicantName={user.displayName}
    />,
  );
}
