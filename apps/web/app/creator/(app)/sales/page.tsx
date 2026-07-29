"use client";

import { useMemo, useState } from "react";
import type { OrderStatus } from "@sofsavdo/types";
import { Alert, SelectField, Skeleton } from "@sofsavdo/ui";
import { useSales } from "@/services/finance";
import { orderStatusMeta } from "@/lib/status";
import { SalesTable } from "@/components/creator/SalesTable";

export default function SalesPage() {
  const query = useSales();
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [campaign, setCampaign] = useState<string>("ALL");

  const campaigns = useMemo(
    () => Array.from(new Set((query.data ?? []).map((s) => s.campaignName))),
    [query.data],
  );

  const filtered = (query.data ?? []).filter(
    (s) => (status === "ALL" || s.orderStatus === status) && (campaign === "ALL" || s.campaignName === campaign),
  );

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <Alert tone="error">Sotuvlarni yuklashda xatolik yuz berdi.</Alert>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Sotuvlar</h1>

      <div className="flex flex-wrap gap-3">
        <SelectField
          label="Holat"
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "ALL")}
        >
          <option value="ALL">Barchasi</option>
          {(Object.keys(orderStatusMeta) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {orderStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Kampaniya" className="w-56" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          <option value="ALL">Barchasi</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </div>

      <SalesTable sales={filtered} />
    </div>
  );
}
