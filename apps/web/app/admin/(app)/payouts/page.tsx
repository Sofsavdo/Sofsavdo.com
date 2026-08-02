"use client";

import { useState } from "react";
import type { PayoutStatus, RealPayoutStatus } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Button, ConfirmModal, DataTableShell, MobileDataCard, StatusBadge, TextField } from "@sofsavdo/ui";
import {
  useAdminPayoutList,
  useAdminPayouts,
  useApproveAdminPayout,
  useApprovePayout,
  useMarkAdminPayoutFailed,
  useMarkAdminPayoutPaid,
  useMarkAdminPayoutProcessing,
  useMarkPayoutPaid,
  useRejectAdminPayout,
  useRejectPayout,
} from "@/services/admin/finance";
import { payoutStatusMeta, realPayoutStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const REAL_STATUSES: RealPayoutStatus[] = ["REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED", "CANCELLED", "FAILED"];

function RealAdminPayoutsPage() {
  const [statusFilter, setStatusFilter] = useState<RealPayoutStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useAdminPayoutList({ status: statusFilter === "ALL" ? undefined : statusFilter, page, pageSize: 20 });
  const approve = useApproveAdminPayout();
  const reject = useRejectAdminPayout();
  const markProcessing = useMarkAdminPayoutProcessing();
  const markPaid = useMarkAdminPayoutPaid();
  const markFailed = useMarkAdminPayoutFailed();
  const [modal, setModal] = useState<{ id: string; mode: "reject" | "failed" } | null>(null);

  const items = query.data?.items ?? [];
  const activeMutation = modal?.mode === "failed" ? markFailed : reject;

  return (
    <DataTableShell
      title="Payoutlar"
      description="Creator to'lov so'rovlari. REQUESTED -> APPROVED -> PROCESSING -> PAID; har bosqichda rad etish/failed bilan yakunlanishi mumkin."
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as RealPayoutStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {REAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {realPayoutStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle="Payout topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={items.map((p) => (
        <MobileDataCard
          key={p.id}
          title={p.creator.displayName}
          meta={<StatusBadge tone={realPayoutStatusMeta[p.status].tone} label={realPayoutStatusMeta[p.status].label} />}
          fields={[
            { label: "Usul", value: p.payoutMethodLabel },
            { label: "Karta raqami", value: p.cardNumber || "—" },
            { label: "So'ralgan", value: new Date(p.requestedAt).toLocaleDateString("uz-UZ") },
            { label: "Summa", value: formatMoneyMinor(p.amountMinor, p.currency), emphasis: true },
          ]}
          actions={
            <>
              {p.status === "REQUESTED" ? (
                <>
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                    Tasdiqlash
                  </Button>
                  <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "reject" })}>
                    Rad etish
                  </Button>
                </>
              ) : null}
              {p.status === "APPROVED" ? (
                <>
                  <Button size="sm" disabled={markProcessing.isPending} onClick={() => markProcessing.mutate(p.id)}>
                    Jarayonga o&apos;tkazish
                  </Button>
                  <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "reject" })}>
                    Rad etish
                  </Button>
                </>
              ) : null}
              {p.status === "PROCESSING" ? (
                <>
                  <Button size="sm" disabled={markPaid.isPending} onClick={() => markPaid.mutate(p.id)}>
                    To&apos;landi deb belgilash
                  </Button>
                  <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "failed" })}>
                    Amalga oshmadi
                  </Button>
                </>
              ) : null}
            </>
          }
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Usul</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Karta raqami</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">So&apos;ralgan</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{p.creator.displayName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(p.amountMinor, p.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.payoutMethodLabel}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted font-numeric">{p.cardNumber || "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(p.requestedAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={realPayoutStatusMeta[p.status].tone} label={realPayoutStatusMeta[p.status].label} />
                {(p.status === "REJECTED" || p.status === "FAILED") && p.rejectionReason ? <p className="mt-1 text-xs text-error">{p.rejectionReason}</p> : null}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <div className="flex gap-1.5">
                  {p.status === "REQUESTED" ? (
                    <>
                      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                        Tasdiqlash
                      </Button>
                      <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "reject" })}>
                        Rad etish
                      </Button>
                    </>
                  ) : null}
                  {p.status === "APPROVED" ? (
                    <>
                      <Button size="sm" disabled={markProcessing.isPending} onClick={() => markProcessing.mutate(p.id)}>
                        Jarayonga o&apos;tkazish
                      </Button>
                      <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "reject" })}>
                        Rad etish
                      </Button>
                    </>
                  ) : null}
                  {p.status === "PROCESSING" ? (
                    <>
                      <Button size="sm" disabled={markPaid.isPending} onClick={() => markPaid.mutate(p.id)}>
                        To&apos;landi deb belgilash
                      </Button>
                      <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "failed" })}>
                        Amalga oshmadi
                      </Button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === "failed" ? "Payoutni amalga oshmadi deb belgilash" : "Payoutni rad etish"}
        requireReason
        reasonLabel="Sabab (majburiy)"
        destructive
        isPending={activeMutation.isPending}
        error={activeMutation.isError ? (activeMutation.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!modal || !reason) return;
          if (modal.mode === "failed") await markFailed.mutateAsync({ id: modal.id, reason });
          else await reject.mutateAsync({ id: modal.id, reason });
          setModal(null);
        }}
      />
    </DataTableShell>
  );
}

export default function AdminPayoutsPage() {
  return <RealAdminPayoutsPage />;
}
