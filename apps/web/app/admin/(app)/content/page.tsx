"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContentStatus } from "@sofsavdo/types";
import { Alert, Badge, Button, ConfirmModal, DataTableShell, StatusBadge } from "@sofsavdo/ui";
import { Paperclip } from "lucide-react";
import { useContentReviewList, useApproveContent, useRequestContentRevision, useRejectContent } from "@/services/admin/content";
import { realContentStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const REAL_FILTERABLE: ContentStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "EXPIRED"];

function RealAdminContentPage() {
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useContentReviewList({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  return (
    <DataTableShell
      title="Kontent moderatsiya"
      description="Creatorlar yuborgan content'ni kampaniya brifi bilan solishtirib ko'rib chiqish."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Creator yoki kampaniya nomi..."
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ContentStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barchasi</option>
          {REAL_FILTERABLE.map((s) => (
            <option key={s} value={s}>
              {realContentStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Content topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
    >
      <div className="divide-y divide-border">
        {(query.data?.items ?? []).map((c) => (
          <Link key={c.id} href={`/admin/content/${c.id}`} className="block p-4 hover:bg-bg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-body text-sm font-medium text-text-primary">
                  {c.creator.displayName} · {c.campaign.name}
                </p>
                <p className="font-body text-xs text-text-muted">{c.caption || "Caption kiritilmagan"}</p>
              </div>
              <StatusBadge tone={realContentStatusMeta[c.status].tone} label={realContentStatusMeta[c.status].label} />
            </div>
          </Link>
        ))}
      </div>
    </DataTableShell>
  );
}

export default function AdminContentPage() {
  return <RealAdminContentPage />;
}
