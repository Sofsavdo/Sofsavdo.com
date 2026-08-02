"use client";

import { useMyLaunchBonus } from "@/services/creator/launch-bonus";
import { Alert, Badge, Card, CardHeader, CardTitle, Skeleton } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";

export function LaunchBonusProgress() {
  const { data: bonus, isLoading } = useMyLaunchBonus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🎁 Launch Bonus</CardTitle>
        </CardHeader>
        <Skeleton className="h-32" />
      </Card>
    );
  }

  if (!bonus) {
    return null;
  }

  const statusMeta: Record<string, { label: string; tone: "success" | "error" | "info" | "warning" }> = {
    LOCKED: { label: "Qulflangan", tone: "warning" },
    UNLOCKED: { label: "Ochilgan", tone: "success" },
    EXPIRED: { label: "Muddati tugagan", tone: "error" },
  };

  const status = (statusMeta[bonus.status || "LOCKED"] || statusMeta.LOCKED)!;
  const daysLeft = Math.max(0, Math.ceil((new Date(bonus.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const requirements = [
    {
      label: "Komissiya",
      current: formatMoneyMinor(bonus.commissionEarnedMinor),
      target: bonus.minCommissionMinor ? formatMoneyMinor(bonus.minCommissionMinor) : "Talab qilinmaydi",
      met: !bonus.minCommissionMinor || bonus.commissionEarnedMinor >= bonus.minCommissionMinor,
    },
    {
      label: "Referral",
      current: bonus.referralsCount,
      target: bonus.minReferrals ?? "Talab qilinmaydi",
      met: !bonus.minReferrals || bonus.referralsCount >= bonus.minReferrals,
    },
    {
      label: "Buyurtma",
      current: bonus.ordersCount,
      target: bonus.minOrders ?? "Talab qilinmaydi",
      met: !bonus.minOrders || bonus.ordersCount >= bonus.minOrders,
    },
    {
      label: "Bio link",
      current: bonus.bioLinkVerified ? "Tasdiqlangan" : "Kutilmoqda",
      target: "Tasdiqlash kerak",
      met: !bonus.bioLinkRequired || bonus.bioLinkVerified,
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const totalCount = requirements.filter((r) => typeof r.target !== "string" || r.target !== "Talab qilinmaydi").length;
  const progressPercent = totalCount > 0 ? (metCount / totalCount) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>🎁 Launch Bonus</CardTitle>
        <Badge tone={status.tone}>{status.label}</Badge>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-lg font-bold text-text-primary">
              {formatMoneyMinor(bonus.bonusAmountMinor)}
            </p>
            <p className="font-body text-sm text-text-secondary">
              {bonus.status === "LOCKED" && daysLeft > 0 ? `${daysLeft} kun qoldi` : bonus.status === "EXPIRED" ? "Muddati tugagan" : "Yechib olish mumkin"}
            </p>
          </div>
          {bonus.status === "LOCKED" && (
            <div className="text-right">
              <p className="font-body text-sm font-medium text-text-primary">{metCount}/{totalCount} shart bajarildi</p>
              <div className="w-32 h-2 bg-border rounded-full mt-1">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        {(bonus.status === "LOCKED") && (
          <div className="space-y-2">
            {requirements.map((req) => (
              <div key={req.label} className="flex items-center justify-between font-body text-sm">
                <span className="text-text-secondary">{req.label}:</span>
                <span className={req.met ? "text-green-600" : "text-text-muted"}>
                  {req.current} / {req.target}
                </span>
              </div>
            ))}
          </div>
        )}

        {(bonus.status === "LOCKED") && !bonus.bioLinkVerified && bonus.bioLinkRequired && (
          <Alert tone="info">
            Bio link tekshirish uchun admin tomonidan ko'rib chiqilmoqda. Profil sahifasida sofsavdo.com havolasini qo'shing.
          </Alert>
        )}

        {(bonus.status === "UNLOCKED") && (
          <Alert tone="success">
            Barcha shartlar bajarildi! Bonusni pul yechish orqali chiqarib olishingiz mumkin.
          </Alert>
        )}

        {(bonus.status === "EXPIRED") && (
          <Alert tone="error">
            Bonus muddati tugagan. Keyingi kampaniyalarda qatnashib yangi bonus olish imkoniyatini qo'lga kiritishingiz mumkin.
          </Alert>
        )}
      </div>
    </Card>
  );
}
