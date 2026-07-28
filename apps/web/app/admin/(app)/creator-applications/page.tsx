"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreatorApplicationStatus } from "@rosti/types";
import { Button, ConfirmModal, DataTableShell, StatusBadge } from "@rosti/ui";
import { useAdminCreators, useApproveCreatorApplication, useRejectCreatorApplication, useRequestCreatorRevision } from "@/services/admin/creators";
import { useOnboardingApplicationList } from "@/services/admin/onboarding";
import { applicationStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const REVIEW_STATUSES: CreatorApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];
const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

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

function MockCreatorApplicationsPage() {
  const query = useAdminCreators();
  const approve = useApproveCreatorApplication();
  const reject = useRejectCreatorApplication();
  const revision = useRequestCreatorRevision();
  const [statusFilter, setStatusFilter] = useState<CreatorApplicationStatus | "ALL">("ALL");
  const [modal, setModal] = useState<{ userId: string; mode: "reject" | "revision" } | null>(null);

  const applicants = (query.data ?? []).filter((u) => u.application.status !== "DRAFT");
  const filtered = statusFilter === "ALL" ? applicants : applicants.filter((u) => u.application.status === statusFilter);

  return (
    <DataTableShell
      title="Creator arizalari"
      description="Onboarding orqali topshirilgan arizalarni ko'rib chiqish."
      filters={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CreatorApplicationStatus | "ALL")}
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
      isEmpty={filtered.length === 0}
      emptyTitle="Ariza topilmadi"
    >
      <ul className="divide-y divide-border">
        {filtered.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/admin/creators/${u.id}`} className="font-body text-sm font-medium text-text-primary hover:text-accent">
                {u.displayName}
              </Link>
              <p className="font-body text-xs text-text-muted">
                {u.email} · {u.application.data.city ?? "—"}
              </p>
              {u.application.reviewNote ? <p className="mt-1 font-body text-xs text-text-secondary">{u.application.reviewNote}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={applicationStatusMeta[u.application.status].tone} label={applicationStatusMeta[u.application.status].label} />
              {u.application.status === "SUBMITTED" || u.application.status === "UNDER_REVIEW" ? (
                <>
                  <Button size="sm" onClick={() => approve.mutate(u.id)} disabled={approve.isPending}>
                    Tasdiqlash
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal({ userId: u.id, mode: "revision" })}>
                    Tuzatish so&apos;rash
                  </Button>
                  <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ userId: u.id, mode: "reject" })}>
                    Rad etish
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === "reject" ? "Arizani rad etish" : "Tuzatish so'rash"}
        description="Sabab creatorga ko'rsatiladi."
        requireReason
        reasonLabel="Sabab"
        destructive={modal?.mode === "reject"}
        isPending={reject.isPending || revision.isPending}
        error={
          reject.isError ? (reject.error as ApiError).message : revision.isError ? (revision.error as ApiError).message : null
        }
        onConfirm={async (reason) => {
          if (!modal || !reason) return;
          if (modal.mode === "reject") await reject.mutateAsync({ userId: modal.userId, reason });
          else await revision.mutateAsync({ userId: modal.userId, reason });
          setModal(null);
        }}
      />
    </DataTableShell>
  );
}

export default function CreatorApplicationsPage() {
  return USE_REAL_API ? <RealCreatorApplicationsPage /> : <MockCreatorApplicationsPage />;
}
