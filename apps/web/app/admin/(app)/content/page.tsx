"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreatorContentStatus, ContentStatus } from "@sofsavdo/types";
import { Alert, Badge, Button, ConfirmModal, DataTableShell, StatusBadge } from "@sofsavdo/ui";
import { Paperclip } from "lucide-react";
import { useAdminContent, useApproveContent, useRejectContent, useRequestContentRevision } from "@/services/admin/content";
import { contentStatusMeta, realContentStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";
import { useContentReviewList } from "@/services/admin/content";

const FILTERABLE: CreatorContentStatus[] = ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "PUBLISHED", "REJECTED"];
const REAL_FILTERABLE: ContentStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "EXPIRED"];
const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

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

function MockAdminContentPage() {
  const query = useAdminContent();
  const approve = useApproveContent();
  const revision = useRequestContentRevision();
  const reject = useRejectContent();
  const [statusFilter, setStatusFilter] = useState<CreatorContentStatus | "ALL">("ALL");
  const [modal, setModal] = useState<{ userId: string; contentId: string; mode: "reject" | "revision" } | null>(null);

  const filtered = (query.data ?? []).filter((row) => statusFilter === "ALL" || row.content.status === statusFilter);

  return (
    <DataTableShell
      title="Kontent moderatsiya"
      description="Creatorlar yuborgan kontentni kampaniya brifi bilan solishtirib ko'rib chiqish."
      filters={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CreatorContentStatus | "ALL")}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barchasi</option>
          {FILTERABLE.map((s) => (
            <option key={s} value={s}>
              {contentStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Kontent topilmadi"
    >
      <div className="divide-y divide-border">
        {filtered.map((row) => (
          <div key={row.content.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-body text-sm font-medium text-text-primary">
                  {row.creatorName} · {row.content.campaignName}
                </p>
                <p className="font-body text-xs text-text-muted">{row.content.platform ?? "—"}</p>
              </div>
              <StatusBadge tone={contentStatusMeta[row.content.status].tone} label={contentStatusMeta[row.content.status].label} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-input border border-border bg-bg p-3">
                <p className="mb-1 font-body text-xs font-medium text-text-muted">Yuborilgan kontent</p>
                <p className="font-body text-sm text-text-primary">{row.content.caption || "Caption kiritilmagan"}</p>
                {row.content.publishedUrl ? (
                  <a href={row.content.publishedUrl} target="_blank" rel="noreferrer" className="mt-1 block font-body text-xs text-accent underline">
                    {row.content.publishedUrl}
                  </a>
                ) : null}
                {row.content.draftFileNames.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.content.draftFileNames.map((f) => (
                      <span key={f} className="flex items-center gap-1 rounded-input border border-border bg-surface px-2 py-0.5 font-body text-xs text-text-secondary">
                        <Paperclip className="size-3" /> {f}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-input border border-border bg-bg p-3">
                <p className="mb-1 font-body text-xs font-medium text-text-muted">Kampaniya brifi</p>
                {row.campaign ? (
                  <div className="space-y-2 font-body text-xs">
                    <div>
                      <p className="mb-1 font-medium text-text-secondary">Majburiy elementlar</p>
                      <ul className="space-y-0.5">
                        {row.campaign.requiredElements.map((el) => (
                          <li key={el} className="text-text-primary">
                            ☐ {el}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {row.campaign.forbiddenElements.length > 0 ? (
                      <div>
                        <p className="mb-1 font-medium text-error">Taqiqlangan da&apos;volar</p>
                        <ul className="space-y-0.5">
                          {row.campaign.forbiddenElements.map((el) => (
                            <li key={el} className="text-error">
                              ✕ {el}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="font-body text-xs text-text-muted">Kampaniya topilmadi.</p>
                )}
              </div>
            </div>

            {row.content.reviewNote ? (
              <Alert tone={row.content.status === "REJECTED" ? "error" : "warning"} className="mt-3">
                {row.content.reviewNote}
              </Alert>
            ) : null}

            {row.content.history.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.content.history.map((h, i) => (
                  <Badge key={i} tone="neutral">
                    {contentStatusMeta[h.status].label} · {new Date(h.at).toLocaleDateString("uz-UZ")}
                  </Badge>
                ))}
              </div>
            ) : null}

            {row.content.status === "SUBMITTED" || row.content.status === "UNDER_REVIEW" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => approve.mutate({ userId: row.userId, contentId: row.content.id })} disabled={approve.isPending}>
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModal({ userId: row.userId, contentId: row.content.id, mode: "revision" })}>
                  Tuzatish so&apos;rash
                </Button>
                <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ userId: row.userId, contentId: row.content.id, mode: "reject" })}>
                  Rad etish
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === "reject" ? "Kontentni rad etish" : "Tuzatish so'rash"}
        description="Izoh creatorga ko'rsatiladi."
        requireReason
        reasonLabel="Izoh"
        destructive={modal?.mode === "reject"}
        isPending={reject.isPending || revision.isPending}
        error={reject.isError ? (reject.error as ApiError).message : revision.isError ? (revision.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!modal || !reason) return;
          if (modal.mode === "reject") await reject.mutateAsync({ userId: modal.userId, contentId: modal.contentId, reason });
          else await revision.mutateAsync({ userId: modal.userId, contentId: modal.contentId, note: reason });
          setModal(null);
        }}
      />
    </DataTableShell>
  );
}

export default function AdminContentPage() {
  return USE_REAL_API ? <RealAdminContentPage /> : <MockAdminContentPage />;
}
