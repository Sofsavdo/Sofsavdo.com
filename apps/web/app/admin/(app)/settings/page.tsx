"use client";

import { useState } from "react";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@rosti/ui";
import { useAdminSettings, useUpdateSettings } from "@/services/admin/system";
import type { PlatformSettings } from "@/services/admin/system";

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const update = useUpdateSettings();

  // Initialized once from the loaded settings (this component only mounts after the query
  // resolves — see SettingsPageContent below) — no effect needed to sync it in.
  const [form, setForm] = useState({
    payoutMinimum: String(settings.payoutMinimumMinor / 100),
    attributionWindow: String(settings.defaultAttributionWindowDays),
    returnPeriod: String(settings.returnPeriodDays),
    shippingFlat: String(settings.shippingFlatMinor / 100),
    telegramEnabled: settings.telegramNotificationsEnabled,
  });

  async function onSave() {
    await update.mutateAsync({
      payoutMinimumMinor: Math.round(Number(form.payoutMinimum) * 100),
      defaultAttributionWindowDays: Number(form.attributionWindow),
      returnPeriodDays: Number(form.returnPeriod),
      shippingFlatMinor: Math.round(Number(form.shippingFlat) * 100),
      telegramNotificationsEnabled: form.telegramEnabled,
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Tizim sozlamalari</h1>

      <Card>
        <CardHeader>
          <CardTitle>Moliyaviy qoidalar</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <TextField label="Minimal payout miqdori (so'm)" value={form.payoutMinimum} onChange={(e) => setForm((f) => ({ ...f, payoutMinimum: e.target.value }))} />
          <TextField label="Standart attribution muddati (kun)" value={form.attributionWindow} onChange={(e) => setForm((f) => ({ ...f, attributionWindow: e.target.value }))} />
          <TextField label="Qaytarish muddati (kun)" value={form.returnPeriod} onChange={(e) => setForm((f) => ({ ...f, returnPeriod: e.target.value }))} />
          <TextField label="Standart yetkazib berish narxi (so'm)" value={form.shippingFlat} onChange={(e) => setForm((f) => ({ ...f, shippingFlat: e.target.value }))} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram bildirishnomalar</CardTitle>
        </CardHeader>
        <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
          <input type="checkbox" checked={form.telegramEnabled} onChange={(e) => setForm((f) => ({ ...f, telegramEnabled: e.target.checked }))} />
          Yangi buyurtma, payout so&apos;rovi va creator arizalari uchun Telegram orqali xabar yuborish
        </label>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov sozlamalari</CardTitle>
        </CardHeader>
        <p className="font-body text-sm text-text-muted">
          Click / Payme / Uzum Nasiya uchun haqiqiy merchant credential Phase 6&apos;da real backend bilan ulanadi — hozircha placeholder.
        </p>
      </Card>

      {update.isSuccess ? <Alert tone="success">Sozlamalar saqlandi.</Alert> : null}
      <Button onClick={onSave} disabled={update.isPending}>
        {update.isPending ? "Saqlanmoqda..." : "Saqlash"}
      </Button>
    </div>
  );
}

function SettingsPageContent() {
  const query = useAdminSettings();
  if (query.isLoading || !query.data) {
    return <Skeleton className="h-64 w-full" />;
  }
  return <SettingsForm settings={query.data} />;
}

export default function AdminSettingsPage() {
  return (
    <RoleGuard min="SUPER_ADMIN">
      <SettingsPageContent />
    </RoleGuard>
  );
}
