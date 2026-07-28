"use client";

import { useState } from "react";
import type { CommissionStatus } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, EmptyState, MobileDataCard, SelectField, Skeleton } from "@rosti/ui";
import { useCommissions } from "@/services/finance";
import { commissionStatusMeta } from "@/lib/status";

export default function CommissionsPage() {
  const query = useCommissions();
  const [status, setStatus] = useState<CommissionStatus | "ALL">("ALL");

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <Alert tone="error">Komissiyalarni yuklashda xatolik yuz berdi.</Alert>;
  }

  const filtered = (query.data ?? []).filter((c) => status === "ALL" || c.status === status);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Komissiyalar</h1>

      <SelectField
        label="Holat"
        className="w-56"
        value={status}
        onChange={(e) => setStatus(e.target.value as CommissionStatus | "ALL")}
      >
        <option value="ALL">Barchasi</option>
        {(Object.keys(commissionStatusMeta) as CommissionStatus[]).map((s) => (
          <option key={s} value={s}>
            {commissionStatusMeta[s].label}
          </option>
        ))}
      </SelectField>

      {filtered.length === 0 ? (
        <EmptyState title="Bu holatda komissiya yo'q" />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <MobileDataCard
                key={c.id}
                title={c.campaignName}
                meta={<Badge tone={commissionStatusMeta[c.status].tone}>{commissionStatusMeta[c.status].label}</Badge>}
                fields={[
                  { label: "Sana", value: new Date(c.createdAt).toLocaleDateString("uz-UZ") },
                  { label: "Baza", value: formatMoneyMinor(c.baseAmountMinor) },
                  { label: "Komissiya", value: formatMoneyMinor(c.amountMinor), emphasis: true },
                ]}
              />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-card border border-border md:block">
            <table className="w-full text-left font-body text-sm">
              <thead className="bg-bg text-text-secondary">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sana</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kampaniya</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Baza</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Komissiya</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                      {new Date(c.createdAt).toLocaleDateString("uz-UZ")}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary">{c.campaignName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-secondary">
                      {formatMoneyMinor(c.baseAmountMinor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">
                      {formatMoneyMinor(c.amountMinor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge tone={commissionStatusMeta[c.status].tone}>{commissionStatusMeta[c.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
