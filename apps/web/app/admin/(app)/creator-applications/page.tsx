"use client";

import { useState } from "react";
import type { CreatorApplicationStatus } from "@sofsavdo/types";
import { Button, ConfirmModal, DataTableShell, StatusBadge } from "@sofsavdo/ui";
import { useOnboardingApplicationList, useApproveCreatorApplication, useRejectCreatorApplication, useRequestCreatorRevision } from "@/services/admin/creators";
import { useOnboardingApplicationList } from "@/services/admin/onboarding";
import { applicationStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const REVIEW_STATUSES: CreatorApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];

// Real-backend queue (Phase 11) — read-only list + search here; the review actions (start-review/
// approve/reject/request-changes) live on the detail page, same layout split as admin/content.
function RealCreatorApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<CreatorApplicationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useOnboardingApplicationList({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  return (
    <DataTableShell
      title="Creator arizalari"
      description="Onboarding orqali topshirilgan arizalarni ko'rib chiqish."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Creator ismi yoki email..."
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CreatorApplicationStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barchasi</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {applicationStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Ariza topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
    >
      <ul className="divide-y divide-border">
        {(query.data?.items ?? []).map((a) => (
          <li key={a.id}>
            <Link href={`/admin/creator-applications/${a.id}`} className="flex flex-col gap-2 p-4 hover:bg-bg sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-medium text-text-primary hover:text-accent">{a.creator.displayName}</p>
                <p className="font-body text-xs text-text-muted">
                  {a.creator.email ?? "—"} · {a.creator.city ?? "—"}
                </p>
              </div>
              <StatusBadge tone={applicationStatusMeta[a.status].tone} label={applicationStatusMeta[a.status].label} />
            </Link>
          </li>
        ))}
      </ul>
    </DataTableShell>
  );
}

export default function CreatorApplicationsPage() {
  return <RealCreatorApplicationsPage />;
}
