"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@sofsavdo/ui";
import { useRealSettings, useUpdateRealSettings } from "@/services/admin/system";
import { ApiError } from "@/lib/api/admin";
import type { RealSettingItem, SettingCategory } from "@sofsavdo/types";

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  general: "Umumiy",
  commission: "Komissiya",
  creatorDefaults: "Creator standartlari",
  notificationDefaults: "Bildirishnoma standartlari",
  paymentConfiguration: "To'lov sozlamalari",
  featureFlags: "Funksiya tugmalari",
  validationRules: "Validatsiya qoidalari",
};

const CATEGORY_ORDER: SettingCategory[] = ["general", "commission", "creatorDefaults", "notificationDefaults", "paymentConfiguration", "featureFlags", "validationRules"];

function SettingField({ item, value, onChange }: { item: RealSettingItem; value: string | number | boolean; onChange: (v: string | number | boolean) => void }) {
  if (item.type === "boolean") {
    return (
      <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {item.label}
      </label>
    );
  }
  return (
    <TextField
      label={item.label}
      type={item.type === "number" ? "number" : "text"}
      value={String(value)}
      onChange={(e) => onChange(item.type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

function SettingsPageContent() {
  const query = useRealSettings();
  const update = useUpdateRealSettings();
  const [changes, setChanges] = useState<Record<string, string | number | boolean>>({});

  const grouped = useMemo(() => {
    const items = query.data ?? [];
    const byCategory = new Map<SettingCategory, RealSettingItem[]>();
    for (const item of items) {
      byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => [c, byCategory.get(c)!] as const);
  }, [query.data]);

  if (query.isLoading || !query.data) {
    return <Skeleton className="h-64 w-full" />;
  }

  async function onSave() {
    if (Object.keys(changes).length === 0) return;
    await update.mutateAsync(changes);
    setChanges({});
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Tizim sozlamalari</h1>

      {grouped.map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <SettingField
                key={item.key}
                item={item}
                value={changes[item.key] ?? item.value}
                onChange={(v) => setChanges((prev) => ({ ...prev, [item.key]: v }))}
              />
            ))}
          </div>
        </Card>
      ))}

      {update.isError ? <Alert tone="error">{(update.error as ApiError).message}</Alert> : null}
      {update.isSuccess && Object.keys(changes).length === 0 ? <Alert tone="success">Sozlamalar saqlandi.</Alert> : null}

      <Button onClick={onSave} disabled={update.isPending || Object.keys(changes).length === 0}>
        {update.isPending ? "Saqlanmoqda..." : "Saqlash"}
      </Button>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <RoleGuard permission="settings.read">
      <SettingsPageContent />
    </RoleGuard>
  );
}
