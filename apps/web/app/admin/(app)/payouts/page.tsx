"use client";

import { useState } from "react";
import type { PayoutStatus } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { Button, ConfirmModal, DataTableShell, StatusBadge, TextField } from "@rosti/ui";
import { useAdminPayouts, useApprovePayout, useMarkPayoutPaid, useRejectPayout } from "@/services/admin/finance";
import { payoutStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const STATUSES: PayoutStatus[] = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID", "REJECTED"];

export default function AdminPayoutsPage() {
  const query = useAdminPayouts();
  const approve = useApprovePayout();
  const reject = useRejectPayout();
  const markPaid = useMarkPayoutPaid();
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "ALL">("ALL");
  const [modal, setModal] = useState<{ id: string; mode: "approve" | "reject" | "paid" } | null>(null);
  const [reference, setReference] = useState("");

  const filtered = (query.data ?? []).filter((p) => statusFilter === "ALL" || p.status === statusFilter);
  const activeMutation = modal?.mode === "approve" ? approve : modal?.mode === "paid" ? markPaid : reject;

  return (
    <DataTableShell
      title="Payoutlar"
      description="Creator to'lov so'rovlari. Bir marta to'langan yoki rad etilgan payout qayta ishlanmaydi (double-spend himoyasi)."
      filters={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PayoutStatus | "ALL")} className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm">
          <option value="ALL">Barcha holatlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {payoutStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Payout topilmadi"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Usul</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">So&apos;ralgan</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{p.creatorName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(p.amountMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{p.payoutMethodLabel}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(p.requestedAt).toLocaleDateString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={payoutStatusMeta[p.status].tone} label={payoutStatusMeta[p.status].label} />
                {p.status === "REJECTED" && p.rejectionReason ? <p className="mt-1 text-xs text-error">{p.rejectionReason}</p> : null}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <div className="flex gap-1.5">
                  {p.status === "REQUESTED" || p.status === "UNDER_REVIEW" ? (
                    <>
                      <Button size="sm" onClick={() => setModal({ id: p.id, mode: "approve" })}>
                        Tasdiqlash
                      </Button>
                      <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: p.id, mode: "reject" })}>
                        Rad etish
                      </Button>
                    </>
                  ) : null}
                  {p.status === "APPROVED" || p.status === "PROCESSING" ? (
                    <Button size="sm" onClick={() => setModal({ id: p.id, mode: "paid" })}>
                      To&apos;landi deb belgilash
                    </Button>
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
        title={modal?.mode === "reject" ? "Payoutni rad etish" : modal?.mode === "paid" ? "To'langan deb belgilash" : "Payoutni tasdiqlash"}
        requireReason={modal?.mode === "reject"}
        reasonLabel="Rad etish sababi"
        destructive={modal?.mode === "reject"}
        isPending={activeMutation.isPending}
        error={activeMutation.isError ? (activeMutation.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!modal) return;
          if (modal.mode === "reject") {
            if (!reason) return;
            await reject.mutateAsync({ payoutId: modal.id, reason });
          } else if (modal.mode === "approve") {
            await approve.mutateAsync({ payoutId: modal.id, referenceNumber: reference || `REF-${Date.now()}` });
          } else {
            await markPaid.mutateAsync({ payoutId: modal.id, referenceNumber: reference || `REF-${Date.now()}` });
          }
          setModal(null);
          setReference("");
        }}
      >
        {modal?.mode !== "reject" ? (
          <TextField label="Tranzaksiya raqami" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Masalan: PAYME-2026-0417" className="mt-2" />
        ) : null}
      </ConfirmModal>
    </DataTableShell>
  );
}
