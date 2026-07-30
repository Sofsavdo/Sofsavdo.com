"use client";

import { useState } from "react";
import type { CommissionStatus } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Button, ConfirmModal, DataTableShell, MobileDataCard, StatusBadge, TextField } from "@sofsavdo/ui";
import { useAdminSession } from "@/services/adminSession";
import { useAdminCommissions, useApproveCommission, useCommissionSettlementList, useManualAdjustCommission, useMarkCommissionPayable, useRejectCommission } from "@/services/admin/finance";
import { commissionStatusMeta } from "@/lib/status";
import { formatCommissionValue } from "@/lib/commission-display";
import { ApiError } from "@/lib/api/admin";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";
const STATUSES: CommissionStatus[] = ["PENDING", "APPROVED", "PAYABLE", "PAID", "DONATED", "REJECTED", "REFUNDED"];

function RealAdminCommissionsPage() {
  const { user: admin } = useAdminSession();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useCommissionSettlementList({ status: statusFilter === "ALL" ? undefined : statusFilter, search: search || undefined, page, pageSize: 20 });
  const approve = useApproveCommission();
  const reject = useRejectCommission();
  const markPayable = useMarkCommissionPayable();
  const [modal, setModal] = useState<{ id: string; mode: "reject" } | null>(null);

  const canAdjust = admin?.permissions.includes("commission.adjust") ?? false;
  const items = query.data?.items ?? [];

  return (
    <DataTableShell
      title="Komissiyalar"
      description="Har bir buyurtma uchun yaratilgan commission — settlement lifecycle bilan birga."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Creator yoki campaign bo'yicha qidirish"
      filters={
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CommissionStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barcha holatlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {commissionStatusMeta[s].label}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle="Komissiya topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={items.map((c) => (
        <MobileDataCard
          key={c.id}
          title={c.creator.displayName}
          meta={<StatusBadge tone={commissionStatusMeta[c.status].tone} label={commissionStatusMeta[c.status].label} />}
          fields={[
            { label: "Campaign", value: c.campaign.name },
            { label: "Baza", value: formatMoneyMinor(c.baseAmountMinor, c.currency) },
            { label: "Komissiya", value: formatMoneyMinor(c.amountMinor, c.currency), emphasis: true },
          ]}
          actions={
            canAdjust ? (
              <>
                {c.status === "PENDING" ? (
                  <>
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>
                      Tasdiqlash
                    </Button>
                    <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: c.id, mode: "reject" })}>
                      Rad etish
                    </Button>
                  </>
                ) : null}
                {c.status === "APPROVED" ? (
                  <>
                    <Button size="sm" disabled={markPayable.isPending} onClick={() => markPayable.mutate(c.id)}>
                      To&apos;lovga tayyor
                    </Button>
                    <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: c.id, mode: "reject" })}>
                      Rad etish
                    </Button>
                  </>
                ) : null}
              </>
            ) : undefined
          }
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Campaign</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Rule</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Baza</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Komissiya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            {canAdjust ? <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{c.creator.displayName}</td>
              <td className="px-4 py-2.5 text-text-secondary">{c.campaign.name}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">
                {formatCommissionValue(c.commissionType, c.commissionType === "PERCENTAGE" ? (c.baseAmountMinor > 0 ? Math.round((c.amountMinor / c.baseAmountMinor) * 10000) : 0) : c.amountMinor)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.baseAmountMinor, c.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(c.amountMinor, c.currency)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={commissionStatusMeta[c.status].tone} label={commissionStatusMeta[c.status].label} />
              </td>
              {canAdjust ? (
                <td className="whitespace-nowrap px-4 py-2.5">
                  <div className="flex gap-1.5">
                    {c.status === "PENDING" ? (
                      <>
                        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>
                          Tasdiqlash
                        </Button>
                        <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: c.id, mode: "reject" })}>
                          Rad etish
                        </Button>
                      </>
                    ) : null}
                    {c.status === "APPROVED" ? (
                      <>
                        <Button size="sm" disabled={markPayable.isPending} onClick={() => markPayable.mutate(c.id)}>
                          To&apos;lovga tayyor
                        </Button>
                        <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setModal({ id: c.id, mode: "reject" })}>
                          Rad etish
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Komissiyani rad etish"
        description="Bu amal ledgerga REVERSAL yozuvi qo'shadi (agar avval tasdiqlangan bo'lsa) va audit logga yoziladi."
        requireReason
        reasonLabel="Sabab (majburiy)"
        destructive
        isPending={reject.isPending}
        error={reject.isError ? (reject.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!modal || !reason) return;
          await reject.mutateAsync({ id: modal.id, reason });
          setModal(null);
        }}
      />
    </DataTableShell>
  );
}

function MockAdminCommissionsPage() {
  const { user: admin } = useAdminSession();
  const query = useAdminCommissions();
  const manualAdjust = useManualAdjustCommission();
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ id: string; currentMinor: number } | null>(null);
  const [newAmount, setNewAmount] = useState("");

  const filtered = (query.data ?? []).filter((c) => c.creatorName.toLowerCase().includes(search.toLowerCase()) || c.campaignName.toLowerCase().includes(search.toLowerCase()));
  const canAdjust = admin?.permissions.includes("commission.adjust") ?? false;

  return (
    <DataTableShell
      title="Komissiyalar"
      description="Har bir buyurtma uchun yaratilgan commission — rule snapshot bilan birga."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Creator yoki campaign bo'yicha qidirish"
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Komissiya topilmadi"
      mobileCards={filtered.map((c) => (
        <MobileDataCard
          key={c.id}
          title={c.creatorName}
          meta={<StatusBadge tone={commissionStatusMeta[c.status].tone} label={commissionStatusMeta[c.status].label} />}
          fields={[
            { label: "Campaign", value: c.campaignName },
            { label: "Baza", value: formatMoneyMinor(c.baseAmountMinor) },
            { label: "Komissiya", value: formatMoneyMinor(c.amountMinor), emphasis: true },
          ]}
          actions={
            canAdjust ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdjustModal({ id: c.id, currentMinor: c.amountMinor });
                  setNewAmount(String(c.amountMinor / 100));
                }}
              >
                Tuzatish
              </Button>
            ) : undefined
          }
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Campaign</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Rule</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Baza</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Komissiya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            {canAdjust ? <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th> : null}
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{c.creatorName}</td>
              <td className="px-4 py-2.5 text-text-secondary">{c.campaignName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{formatCommissionValue(c.commissionType, c.commissionValue)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-secondary">{formatMoneyMinor(c.baseAmountMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">{formatMoneyMinor(c.amountMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge tone={commissionStatusMeta[c.status].tone} label={commissionStatusMeta[c.status].label} />
              </td>
              {canAdjust ? (
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdjustModal({ id: c.id, currentMinor: c.amountMinor });
                      setNewAmount(String(c.amountMinor / 100));
                    }}
                  >
                    Tuzatish
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title="Komissiyani qo'lda o'zgartirish"
        description="Bu amal ledgerga ACCRUAL yoki REVERSAL yozuvi qo'shadi va audit logga yoziladi."
        requireReason
        reasonLabel="Sabab (majburiy)"
        isPending={manualAdjust.isPending}
        error={manualAdjust.isError ? (manualAdjust.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!adjustModal || !reason) return;
          await manualAdjust.mutateAsync({ id: adjustModal.id, newAmountMinor: Math.round(Number(newAmount) * 100), reason });
          setAdjustModal(null);
        }}
      >
        <TextField label="Yangi komissiya summasi (so'm)" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="mt-2" />
      </ConfirmModal>
    </DataTableShell>
  );
}

export default function AdminCommissionsPage() {
  return USE_REAL_API ? <RealAdminCommissionsPage /> : <MockAdminCommissionsPage />;
}
