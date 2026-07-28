"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton } from "@rosti/ui";
import { ArrowLeft } from "lucide-react";
import {
  useOnboardingApplicationDetail,
  useOnboardingAuditTrail,
  useStartReviewOnboardingApplication,
  useApproveOnboardingApplication,
  useRejectOnboardingApplication,
  useRequestChangesOnboardingApplication,
} from "@/services/admin/onboarding";
import { applicationStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  ONBOARDING_REVIEW_STARTED: "Ko'rib chiqish boshlandi",
  ONBOARDING_APPROVED: "Tasdiqlandi",
  ONBOARDING_REJECTED: "Rad etildi",
  ONBOARDING_CHANGES_REQUESTED: "O'zgartirish so'raldi",
};

export default function AdminOnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useOnboardingApplicationDetail(id);
  const auditQuery = useOnboardingAuditTrail(id);
  const startReview = useStartReviewOnboardingApplication();
  const approve = useApproveOnboardingApplication();
  const reject = useRejectOnboardingApplication();
  const requestChanges = useRequestChangesOnboardingApplication();
  const [modal, setModal] = useState<"reject" | "request-changes" | null>(null);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <Alert tone="error">
        Ariza topilmadi.{" "}
        <Link href="/admin/creator-applications" className="underline">
          Ro&apos;yxatga qaytish
        </Link>
      </Alert>
    );
  }

  const application = query.data;
  const formDataEntries = Object.entries(application.formData ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const actionError = startReview.isError
    ? (startReview.error as ApiError).message
    : approve.isError
      ? (approve.error as ApiError).message
      : reject.isError
        ? (reject.error as ApiError).message
        : requestChanges.isError
          ? (requestChanges.error as ApiError).message
          : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/creator-applications" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body text-sm text-text-muted">
            {application.creator.email ?? "—"} · {application.creator.city ?? "—"}
          </p>
          <h1 className="font-heading text-xl font-bold text-text-primary">{application.creator.displayName}</h1>
        </div>
        <Badge tone={applicationStatusMeta[application.status].tone}>{applicationStatusMeta[application.status].label}</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ariza ma&apos;lumotlari</CardTitle>
            </CardHeader>
            {formDataEntries.length === 0 ? (
              <p className="font-body text-sm text-text-muted">Hali to&apos;ldirilmagan (qadam {application.currentStep}).</p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 font-body text-sm sm:grid-cols-2">
                {formDataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-text-muted">{key}</dt>
                    <dd className="text-text-primary">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {application.reviewNote ? (
            <Alert tone={application.status === "REJECTED" ? "error" : "warning"}>
              <strong>Admin izohi:</strong> {application.reviewNote}
            </Alert>
          ) : null}

          {application.status === "SUBMITTED" || application.status === "UNDER_REVIEW" ? (
            <Card>
              <CardHeader>
                <CardTitle>Harakatlar</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {application.status === "SUBMITTED" ? (
                  <Button size="sm" disabled={startReview.isPending} onClick={() => startReview.mutate(id)}>
                    Ko&apos;rib chiqishni boshlash
                  </Button>
                ) : null}
                {application.status === "UNDER_REVIEW" ? (
                  <>
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(id)}>
                      {approve.isPending ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setModal("request-changes")}>
                      O&apos;zgartirish so&apos;rash
                    </Button>
                    <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal("reject")}>
                      Rad etish
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ko&apos;rib chiquvchi tarixi</CardTitle>
            </CardHeader>
            {auditQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !auditQuery.data || auditQuery.data.length === 0 ? (
              <p className="font-body text-sm text-text-muted">Hozircha harakat yo&apos;q.</p>
            ) : (
              <ul className="space-y-3">
                {auditQuery.data.map((entry) => (
                  <li key={entry.id} className="border-b border-border pb-3 last:border-none last:pb-0">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone="neutral">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                      <span className="font-body text-xs text-text-muted">{new Date(entry.createdAt).toLocaleDateString("uz-UZ")}</span>
                    </div>
                    <p className="font-body text-xs text-text-secondary">{entry.actor?.email ?? "Tizim"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "reject" ? "Arizani rad etish" : "O'zgartirish so'rash"}
        description="Sabab creatorga ko'rsatiladi."
        requireReason
        reasonLabel="Sabab"
        destructive={modal === "reject"}
        isPending={reject.isPending || requestChanges.isPending}
        onConfirm={async (reason) => {
          if (!reason) return;
          if (modal === "reject") await reject.mutateAsync({ id, reason });
          else if (modal === "request-changes") await requestChanges.mutateAsync({ id, reason });
          setModal(null);
        }}
      />
    </div>
  );
}
