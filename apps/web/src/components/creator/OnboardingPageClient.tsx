"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
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
          Rosti
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

  if (application.status === "REJECTED") {
    return shell(
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Ariza rad etildi</CardTitle>
        </CardHeader>
        <Alert tone="error">{application.reviewNote ?? "Arizangiz rad etildi."}</Alert>
        <p className="mt-4 font-body text-sm text-text-secondary">
          Ko&apos;rsatilgan sababni bartaraf etgach, qayta ariza topshirishingiz mumkin bo&apos;ladi.
        </p>
      </Card>,
    );
  }

  // DRAFT or REVISION_REQUESTED — editable wizard
  return shell(
    <OnboardingWizard
      initialData={application.data}
      initialStep={application.currentStep || 1}
      revisionNote={application.status === "REVISION_REQUESTED" ? application.reviewNote : undefined}
    />,
  );
}
