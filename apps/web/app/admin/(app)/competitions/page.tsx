"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Gift } from "lucide-react";
import { Button, DataTableShell, MobileDataCard, StatusBadge, Card, CardHeader, CardTitle, TextField } from "@sofsavdo/ui";
import { useAdminCompetitions } from "@/services/admin/competitions";
import { useLaunchBonusSettings, useUpdateLaunchBonusSettings } from "@/services/admin/launch-bonus";
import { competitionStatusMeta } from "@/lib/status";

export default function AdminCompetitionsPage() {
  const query = useAdminCompetitions();
  const [search, setSearch] = useState("");
  const [showLaunchBonus, setShowLaunchBonus] = useState(false);
  const { data: settings, isLoading: settingsLoading } = useLaunchBonusSettings();
  const { mutate: updateSettings, isPending, isError, error } = useUpdateLaunchBonusSettings();

  const filtered = useMemo(
    () => (query.data?.items ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  );

  const handleLaunchBonusSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateSettings({
      bonusAmountMinor: parseInt(formData.get("bonusAmountMinor") as string) || 200000000,
      deadlineDays: parseInt(formData.get("deadlineDays") as string) || 30,
      minCommissionMinor: parseInt(formData.get("minCommissionMinor") as string) || 500000000,
      minReferrals: parseInt(formData.get("minReferrals") as string) || 3,
      minOrders: parseInt(formData.get("minOrders") as string) || 5,
      bioLinkRequired: formData.get("bioLinkRequired") === "true",
      isActive: formData.get("isActive") === "true",
    });
  };

  return (
    <div className="space-y-6">
      {/* Launch Bonus Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="size-5 text-accent" />
              <CardTitle>Launch Bonus Sozlamalari</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowLaunchBonus(!showLaunchBonus)}>
              {showLaunchBonus ? "Yopish" : "Sozlash"}
            </Button>
          </div>
        </CardHeader>
        {showLaunchBonus && (
          <div className="p-4 border-t border-border">
            {settingsLoading ? (
              <p>Yuklanmoqda...</p>
            ) : (
              <form onSubmit={handleLaunchBonusSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Bonus Miqdori (tiyin)"
                    name="bonusAmountMinor"
                    type="number"
                    defaultValue={settings?.bonusAmountMinor || 200000000}
                    required
                  />
                  <TextField
                    label="Muddat (kun)"
                    name="deadlineDays"
                    type="number"
                    defaultValue={settings?.deadlineDays || 30}
                    required
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="font-heading text-sm font-medium text-text-primary">Talablar</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <TextField
                      label="Min. Komissiya (tiyin)"
                      name="minCommissionMinor"
                      type="number"
                      defaultValue={settings?.minCommissionMinor || 500000000}
                    />
                    <TextField
                      label="Min. Referral"
                      name="minReferrals"
                      type="number"
                      defaultValue={settings?.minReferrals || 3}
                    />
                    <TextField
                      label="Min. Buyurtma"
                      name="minOrders"
                      type="number"
                      defaultValue={settings?.minOrders || 5}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      name="bioLinkRequired"
                      defaultChecked={settings?.bioLinkRequired ?? true}
                      value="true"
                    />
                    Bio Link Talab qilinsinmi
                  </label>

                  <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={settings?.isActive ?? true}
                      value="true"
                    />
                    Tizim Faolmi
                  </label>
                </div>

                {isError ? <div className="text-sm text-error">{(error as any)?.message || "Xatolik yuz berdi"}</div> : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Competitions List */}
      <DataTableShell
        title="Musobaqalar"
        description="Creatorlar uchun vaqtga bog'liq motivatsion musobaqalar."
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <Button asChild size="sm">
            <Link href="/admin/competitions/new">
              <Plus className="mr-1.5 size-4" /> Yangi musobaqa
            </Link>
          </Button>
        }
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        isEmpty={filtered.length === 0}
        emptyTitle="Musobaqa topilmadi"
        mobileCards={filtered.map((c) => (
          <MobileDataCard
            key={c.id}
            href={`/admin/competitions/${c.id}`}
            title={c.name}
            meta={<StatusBadge tone={competitionStatusMeta[c.status].tone} label={competitionStatusMeta[c.status].label} />}
            fields={[
              { label: "Metrika", value: c.metric === "ORDER_COUNT" ? "Buyurtma soni" : "Do'stlar soni" },
              { label: "Boshlanish", value: new Date(c.startAt).toLocaleDateString("uz-UZ") },
              { label: "Tugash", value: new Date(c.endAt).toLocaleDateString("uz-UZ") },
            ]}
          />
        ))}
      >
        <table className="w-full text-left font-body text-sm">
          <thead className="bg-bg text-text-secondary">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium">Musobaqa</th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium">Metrika</th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium">Boshlanish</th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tugash</th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/competitions/${c.id}`} className="font-medium text-text-primary hover:text-accent">
                    {c.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{c.metric === "ORDER_COUNT" ? "Buyurtma soni" : "Do'stlar soni"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{new Date(c.startAt).toLocaleDateString("uz-UZ")}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{new Date(c.endAt).toLocaleDateString("uz-UZ")}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <StatusBadge tone={competitionStatusMeta[c.status].tone} label={competitionStatusMeta[c.status].label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
