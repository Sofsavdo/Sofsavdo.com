"use client";

import { useMemo, useState } from "react";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Badge, Button, ConfirmModal, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useAdminReferralLinks, useDeactivateReferralLink } from "@/services/admin/marketing";

export default function AdminReferralLinksPage() {
  const query = useAdminReferralLinks();
  const deactivate = useDeactivateReferralLink();
  const [search, setSearch] = useState("");
  const [confirmCode, setConfirmCode] = useState<string | null>(null);

  const filtered = useMemo(
    () => (query.data ?? []).filter((l) => l.creatorName.toLowerCase().includes(search.toLowerCase()) || l.campaignName.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  );

  return (
    <DataTableShell
      title="Referral havolalar"
      description="Har bir creator-campaign juftligi uchun bitta referral havola avtomatik yaratiladi."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Creator yoki campaign bo'yicha qidirish"
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Referral havola topilmadi"
      mobileCards={filtered.map((l) => (
        <MobileDataCard
          key={l.code}
          title={l.creatorName}
          meta={<Badge tone={l.status === "ACTIVE" ? "success" : "neutral"}>{l.status}</Badge>}
          fields={[
            { label: "Campaign / Offer", value: `${l.campaignName} · ${l.offerName}` },
            { label: "Clicks", value: l.clicks },
            { label: "Orders", value: l.orders },
            { label: "Revenue", value: formatMoneyMinor(l.revenueMinor), emphasis: true },
          ]}
          actions={
            l.status === "ACTIVE" ? (
              <Button size="sm" variant="ghost" className="text-error" onClick={() => setConfirmCode(l.code)}>
                Deaktivatsiya
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
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Campaign / Offer</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Clicks</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Orders</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Revenue</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => (
            <tr key={l.code} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5 text-text-primary">{l.creatorName}</td>
              <td className="px-4 py-2.5 text-text-secondary">
                {l.campaignName}
                <br />
                <span className="text-xs text-text-muted">{l.offerName}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums">{l.clicks}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums">{l.orders}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums">{formatMoneyMinor(l.revenueMinor)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={l.status === "ACTIVE" ? "success" : "neutral"}>{l.status}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {l.status === "ACTIVE" ? (
                  <Button size="sm" variant="ghost" className="text-error" onClick={() => setConfirmCode(l.code)}>
                    Deaktivatsiya
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={!!confirmCode}
        onClose={() => setConfirmCode(null)}
        title="Referral havolani deaktivatsiya qilish"
        description="Bu havola orqali endi yangi click/hisob yozilmaydi."
        confirmLabel="Deaktivatsiya qilish"
        destructive
        isPending={deactivate.isPending}
        onConfirm={async () => {
          if (!confirmCode) return;
          await deactivate.mutateAsync(confirmCode);
          setConfirmCode(null);
        }}
      />
    </DataTableShell>
  );
}
