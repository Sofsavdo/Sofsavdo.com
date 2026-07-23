"use client";

import { useState } from "react";
import { formatMoneyMinor } from "@rosti/types";
import { Button, ConfirmModal, DataTableShell, StatusBadge, TextField } from "@rosti/ui";
import { useAdminSession } from "@/services/adminSession";
import { hasRole } from "@/lib/adminRouting";
import { useAdminCommissions, useManualAdjustCommission } from "@/services/admin/finance";
import { commissionStatusMeta } from "@/lib/status";
import { formatCommissionValue } from "@/lib/commission-display";
import { ApiError } from "@/lib/api/admin";

export default function AdminCommissionsPage() {
  const { user: admin } = useAdminSession();
  const query = useAdminCommissions();
  const manualAdjust = useManualAdjustCommission();
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ id: string; currentMinor: number } | null>(null);
  const [newAmount, setNewAmount] = useState("");

  const filtered = (query.data ?? []).filter((c) => c.creatorName.toLowerCase().includes(search.toLowerCase()) || c.campaignName.toLowerCase().includes(search.toLowerCase()));
  const canAdjust = hasRole(admin?.role, "ADMIN");

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
