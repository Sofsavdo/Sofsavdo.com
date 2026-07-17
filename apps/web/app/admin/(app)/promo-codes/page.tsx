"use client";

import { useState } from "react";
import { formatPercent, formatMoneyMinor } from "@rosti/types";
import { Badge, DataTableShell } from "@rosti/ui";
import { useAdminPromoCodes } from "@/services/admin/marketing";

export default function AdminPromoCodesPage() {
  const query = useAdminPromoCodes();
  const [search, setSearch] = useState("");

  const filtered = (query.data ?? []).filter(
    (p) => p.code.toLowerCase().includes(search.toLowerCase()) || p.creatorName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DataTableShell
      title="Promo kodlar"
      description="Har bir creator-campaign juftligi uchun bitta promo kod. Qo'lda yaratish faqat Admin+ ruxsati bilan."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Kod yoki creator bo'yicha qidirish"
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Promo kod topilmadi"
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kod</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Campaign</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Chegirma</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Ishlatilgan / Limit</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.code} className="border-t border-border hover:bg-bg">
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-accent">{p.code}</td>
              <td className="px-4 py-2.5 text-text-primary">{p.creatorName}</td>
              <td className="px-4 py-2.5 text-text-secondary">{p.campaignName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                {p.discountValue === 0 ? "—" : p.discountType === "PERCENTAGE" ? formatPercent(p.discountValue) : formatMoneyMinor(p.discountValue)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums">
                {p.usageCount}
                {p.usageLimit ? ` / ${p.usageLimit}` : ""}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Faol" : "Nofaol"}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
