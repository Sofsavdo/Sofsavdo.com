"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { useLaunchBonusSettings, useUpdateLaunchBonusSettings, usePendingBioVerifications, useVerifyBioLink } from "@/services/admin/launch-bonus";
import { Alert, Button, Card, CardHeader, CardTitle, TextField } from "@sofsavdo/ui";
import { ApiError } from "@/lib/api/admin";

export default function LaunchBonusSettingsPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "verifications">("settings");
  const { data: settings, isLoading: settingsLoading } = useLaunchBonusSettings();
  const { mutate: updateSettings, isPending, isError, error } = useUpdateLaunchBonusSettings();
  const { data: pendingVerifications, isLoading: verificationsLoading } = usePendingBioVerifications();
  const { mutate: verifyBio } = useVerifyBioLink();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Get values from form - they're already in so'm for display
    const bonusAmountSoM = parseInt(formData.get("bonusAmountMinor") as string) || 2000000;
    const minCommissionSoM = parseInt(formData.get("minCommissionMinor") as string) || 5000000;
    
    // Convert so'm to tiyin (multiply by 100) for backend
    updateSettings({
      bonusAmountMinor: bonusAmountSoM * 100,
      deadlineDays: parseInt(formData.get("deadlineDays") as string) || 30,
      minCommissionMinor: minCommissionSoM * 100,
      minReferrals: parseInt(formData.get("minReferrals") as string) || 3,
      minOrders: parseInt(formData.get("minOrders") as string) || 5,
      bioLinkRequired: formData.get("bioLinkRequired") === "true",
      isActive: formData.get("isActive") === "true",
    });
  };

  const handleVerifyBio = (creatorProfileId: string, approved: boolean) => {
    verifyBio({ creatorProfileId, approved });
  };

  if (settingsLoading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center h-64">
          <p>Yuklanmoqda...</p>
        </div>
      </AdminShell>
    );
  }

  return (
    <RoleGuard permission="launch_bonus.admin">
      <AdminShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold text-text-primary">Launch Bonus Tizimi</h1>
              <p className="font-body text-sm text-text-secondary">
                Yangi creatorlar uchun bonus tizimini boshqaring
              </p>
            </div>
          </div>

          <div className="border-b border-border">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-4 px-1 border-b-2 font-body text-sm font-medium transition-colors ${
                  activeTab === "settings"
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                Sozlamalar
              </button>
              <button
                onClick={() => setActiveTab("verifications")}
                className={`pb-4 px-1 border-b-2 font-body text-sm font-medium transition-colors ${
                  activeTab === "verifications"
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                Bio Tekshirish ({pendingVerifications?.length || 0})
              </button>
            </div>
          </div>

          {activeTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Umumiy Sozlamalar</CardTitle>
              </CardHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Bonus Miqdori (so'm)"
                    name="bonusAmountMinor"
                    type="number"
                    defaultValue={settings?.bonusAmountMinor ? Math.floor(settings.bonusAmountMinor / 100) : 2000000}
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
                      label="Min. Komissiya (so'm)"
                      name="minCommissionMinor"
                      type="number"
                      defaultValue={settings?.minCommissionMinor ? Math.floor(settings.minCommissionMinor / 100) : 5000000}
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

                {isError ? <Alert tone="error">{(error as ApiError).message}</Alert> : null}

                <div className="flex justify-end">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "verifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Bio Tekshirish Navbati</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-4">
                {verificationsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <p>Yuklanmoqda...</p>
                  </div>
                ) : !pendingVerifications || pendingVerifications.length === 0 ? (
                  <div className="text-center py-12 font-body text-sm text-text-muted">
                    <p>Hozircha bio tekshirish kutayotgan creator yo'q</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingVerifications.map((item: any) => (
                      <div key={item.id} className="border border-border rounded-input p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-heading text-sm font-medium text-text-primary">{item.creatorProfile.displayName}</h3>
                            <p className="font-body text-sm text-text-secondary">
                              {item.creatorProfile.user.email || item.creatorProfile.user.phone}
                            </p>
                          </div>
                          <div className="font-body text-sm text-text-muted">
                            {new Date(item.deadline).toLocaleDateString('uz-UZ')}
                          </div>
                        </div>
                        
                        {item.creatorProfile.socialAccounts && item.creatorProfile.socialAccounts.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-body text-sm font-medium text-text-primary">Social Accounts:</p>
                            <div className="flex flex-wrap gap-2">
                              {item.creatorProfile.socialAccounts.map((acc: any) => (
                                <a
                                  key={acc.id}
                                  href={acc.profileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-body text-sm text-accent hover:underline"
                                >
                                  {acc.platform}: {acc.handle}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleVerifyBio(item.creatorProfileId, true)}
                          >
                            Tasdiqlash
                          </Button>
                          <Button
                            onClick={() => handleVerifyBio(item.creatorProfileId, false)}
                          >
                            Rad etish
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </AdminShell>
    </RoleGuard>
  );
}
