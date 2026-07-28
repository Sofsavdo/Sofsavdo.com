"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
import { BRAND } from "@rosti/config/brand";
import { useSession } from "@/services/session";
import { applicationStatusMeta } from "@/lib/status";
import { OnboardingWizard } from "./OnboardingWizard";

export function OnboardingPageClient() {
  const router = useRouter();
  const { user, isLoading, logout } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/creator/login");
      return;
    }
    if (user.application.status === "APPROVED") {
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

  if (application.status === "APPROVED") return null; // redirecting

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

  if (application.status === "SUBMITTED" || application.status === "UNDER_REVIEW") {
    return shell(
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Arizangiz ko&apos;rib chiqilmoqda</CardTitle>
        </CardHeader>
        <Alert tone="info">
          Arizangiz {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("uz-UZ") : ""}{" "}
          sanasida yuborilgan va hozirda {applicationStatusMeta[application.status].label.toLowerCase()}. Admin
          tomonidan ko&apos;rib chiqilgach, natija haqida sizga xabar beramiz.
        </Alert>
      </Card>,
    );
  }

  // DRAFT, CHANGES_REQUESTED, or REJECTED — all editable. Unlike CampaignApplication, REJECTED is
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
    />,
  );
}
