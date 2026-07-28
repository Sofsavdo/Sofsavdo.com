"use client";

import type { RealNotificationCategory } from "@rosti/types";
import { Alert, Card, Skeleton } from "@rosti/ui";
import { useNotificationPreferences, useUpdateNotificationPreference } from "@/services/notifications";
import { notificationCategoryMeta } from "@/lib/status";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";
const CHANNELS: { key: "inApp" | "telegram" | "email"; label: string }[] = [
  { key: "inApp", label: "Ilova ichida" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "Email" },
];

function RealNotificationPreferencesPage() {
  const query = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <Alert tone="error">Sozlamalarni yuklashda xatolik yuz berdi.</Alert>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Bildirishnoma sozlamalari</h1>
      <p className="font-body text-sm text-text-secondary">
        Har bir toifa uchun qaysi kanal orqali xabar olishni belgilang. Telegram xabarlari faqat Telegram hisobingiz ulangan bo&apos;lsa yetkaziladi.
      </p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body text-sm">
            <thead className="bg-bg text-text-secondary">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 font-medium">Toifa</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-4 py-2.5 text-center font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((pref) => (
                <tr key={pref.category} className="border-t border-border">
                  <td className="px-4 py-2.5 text-text-primary">{notificationCategoryMeta[pref.category as RealNotificationCategory]?.label ?? pref.category}</td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={pref[c.key]}
                        disabled={update.isPending}
                        onChange={(e) => update.mutate({ category: pref.category as RealNotificationCategory, patch: { [c.key]: e.target.checked } })}
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {update.isError ? <Alert tone="error">Sozlamani saqlashda xatolik yuz berdi.</Alert> : null}
    </div>
  );
}

function MockNotificationPreferencesPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Bildirishnoma sozlamalari</h1>
      <Alert tone="info">Bildirishnoma sozlamalari faqat real backend rejimida (NEXT_PUBLIC_API_MODE=real) mavjud.</Alert>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  return USE_REAL_API ? <RealNotificationPreferencesPage /> : <MockNotificationPreferencesPage />;
}
