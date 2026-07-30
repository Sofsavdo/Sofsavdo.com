"use client";

import { useState } from "react";
import { Badge, Button, ConfirmModal, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useAdminSession } from "@/services/adminSession";
import { useAdminVisitors, useOverrideAttribution } from "@/services/admin/marketing";
import { useAdminOrders } from "@/services/admin/orders";
import { useAdminCreators } from "@/services/admin/creators";

export default function AdminVisitorsPage() {
  const { user: admin } = useAdminSession();
  const query = useAdminVisitors();
  const ordersQuery = useAdminOrders();
  const creatorsQuery = useAdminCreators();
  const overrideAttribution = useOverrideAttribution();
  const [search, setSearch] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<{ orderId: string; newCreatorId: string } | null>(null);

  const filtered = (query.data ?? []).filter(
    (v) => v.offerName.toLowerCase().includes(search.toLowerCase()) || (v.creatorName ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const canOverride = admin?.permissions.includes("attribution.override") ?? false;

  function orderIdForToken(token?: string) {
    return ordersQuery.data?.find((o) => o.publicToken === token)?.id;
  }

  return (
    <DataTableShell
      title="Visitors"
      description="Referral visitlar va attribution manbasi. Qo'lda o'zgartirish faqat Super Admin uchun."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Offer yoki creator bo'yicha qidirish"
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={filtered.length === 0}
      emptyTitle="Visitor topilmadi"
      mobileCards={filtered.map((v) => {
        const orderId = orderIdForToken(v.attributedOrderToken);
        return (
          <MobileDataCard
            key={v.id}
            title={v.offerName}
            meta={<Badge tone={v.source === "PROMO_CODE" ? "accent" : "info"}>{v.source === "PROMO_CODE" ? "Promo kod" : "Referral"}</Badge>}
            fields={[
              { label: "Creator", value: v.creatorName ?? "—" },
              { label: "Campaign", value: v.campaignName },
              { label: "Yaratilgan", value: new Date(v.createdAt).toLocaleDateString("uz-UZ") },
              { label: "Fraud", value: v.fraudRiskFlags.length > 0 ? v.fraudRiskFlags.join(", ") : "—" },
            ]}
            actions={
              canOverride && orderId ? (
                <select
                  className="h-8 rounded-input border border-border bg-surface px-2 font-body text-xs"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) setOverrideTarget({ orderId, newCreatorId: e.target.value });
                  }}
                >
                  <option value="">Attributionni o&apos;zgartirish...</option>
                  {(creatorsQuery.data ?? [])
                    .filter((c) => c.application.status === "APPROVED")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                      </option>
                    ))}
                </select>
              ) : undefined
            }
          />
        );
      })}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Visitor ID</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Offer / Campaign</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Creator</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Manba</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Yaratilgan / Muddati</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Fraud</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => {
            const orderId = orderIdForToken(v.attributedOrderToken);
            return (
              <tr key={v.id} className="border-t border-border hover:bg-bg">
                <td className="whitespace-nowrap px-4 py-2.5 font-numeric text-xs text-text-secondary">{v.visitorId}</td>
                <td className="px-4 py-2.5 text-text-primary">
                  {v.offerName}
                  <br />
                  <span className="text-xs text-text-muted">{v.campaignName}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{v.creatorName ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Badge tone={v.source === "PROMO_CODE" ? "accent" : "info"}>{v.source === "PROMO_CODE" ? "Promo kod" : "Referral"}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">
                  {new Date(v.createdAt).toLocaleDateString("uz-UZ")} → {new Date(v.expiresAt).toLocaleDateString("uz-UZ")}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {v.fraudRiskFlags.length > 0 ? <Badge tone="error">{v.fraudRiskFlags.join(", ")}</Badge> : <span className="text-text-muted">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {canOverride && orderId ? (
                    <select
                      className="h-8 rounded-input border border-border bg-surface px-2 font-body text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) setOverrideTarget({ orderId, newCreatorId: e.target.value });
                      }}
                    >
                      <option value="">Attributionni o&apos;zgartirish...</option>
                      {(creatorsQuery.data ?? [])
                        .filter((c) => c.application.status === "APPROVED")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmModal
        open={!!overrideTarget}
        onClose={() => setOverrideTarget(null)}
        title="Attributionni qo'lda o'zgartirish"
        description="Bu amal audit logga yoziladi va qaytarib bo'lmaydi."
        requireReason
        reasonLabel="Sabab (majburiy)"
        destructive
        isPending={overrideAttribution.isPending}
        onConfirm={async (reason) => {
          if (!overrideTarget || !reason) return;
          await overrideAttribution.mutateAsync({ orderId: overrideTarget.orderId, newCreatorId: overrideTarget.newCreatorId, reason });
          setOverrideTarget(null);
        }}
      />
    </DataTableShell>
  );
}
