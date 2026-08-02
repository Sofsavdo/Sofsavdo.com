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

  // Default values when no bonus exists - always show 2,000,000 UZS LOCKED
  const DEFAULT_BONUS_AMOUNT = 200000000; // 2,000,000 UZS in minor units
  const DEFAULT_DEADLINE_DAYS = 30;
  const DEFAULT_MIN_COMMISSION = 500000000; // 5,000,000 UZS
  const DEFAULT_MIN_REFERRALS = 3;
  const DEFAULT_MIN_ORDERS = 5;

  const bonusAmountMinor = bonus?.bonusAmountMinor ?? DEFAULT_BONUS_AMOUNT;
  const status = bonus?.status ?? "LOCKED";
  const deadline = bonus?.deadline ?? new Date(Date.now() + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
  const commissionEarnedMinor = bonus?.commissionEarnedMinor ?? 0;
  const referralsCount = bonus?.referralsCount ?? 0;
  const ordersCount = bonus?.ordersCount ?? 0;
  const bioLinkVerified = bonus?.bioLinkVerified ?? false;
  const minCommissionMinor = bonus?.minCommissionMinor ?? DEFAULT_MIN_COMMISSION;
  const minReferrals = bonus?.minReferrals ?? DEFAULT_MIN_REFERRALS;
  const minOrders = bonus?.minOrders ?? DEFAULT_MIN_ORDERS;
  const bioLinkRequired = bonus?.bioLinkRequired ?? true;

  const statusMeta: Record<string, { label: string; tone: "success" | "error" | "info" | "warning" }> = {
    LOCKED: { label: "QULFLANGAN", tone: "warning" },
    UNLOCKED: { label: "OCHILGAN", tone: "success" },
    EXPIRED: { label: "MUDDATI TUGAGAN", tone: "error" },
  };

  const currentStatus = (statusMeta[status] ?? statusMeta.LOCKED)!;
  const daysLeft = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const requirements = [
    {
      label: "Komissiya",
      current: formatMoneyMinor(commissionEarnedMinor),
      target: formatMoneyMinor(minCommissionMinor),
      met: commissionEarnedMinor >= minCommissionMinor,
    },
    {
      label: "Referral",
      current: referralsCount,
      target: minReferrals,
      met: referralsCount >= minReferrals,
    },
    {
      label: "Buyurtma",
      current: ordersCount,
      target: minOrders,
      met: ordersCount >= minOrders,
    },
    {
      label: "Bio link",
      current: bioLinkVerified ? "Tasdiqlangan" : "Kutilmoqda",
      target: "Tasdiqlash kerak",
      met: !bioLinkRequired || bioLinkVerified,
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const totalCount = requirements.length;
  const progressPercent = totalCount > 0 ? (metCount / totalCount) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>🎁 Launch Bonus</CardTitle>
        <Badge tone={currentStatus.tone}>{currentStatus.label}</Badge>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-3xl font-bold text-accent">
              {formatMoneyMinor(bonusAmountMinor)}
            </p>
            <p className="font-body text-sm text-text-secondary">
              {status === "LOCKED" && daysLeft > 0 ? `${daysLeft} kun qoldi` : status === "EXPIRED" ? "Muddati tugagan" : "Yechib olish mumkin"}
            </p>
          </div>
          {status === "LOCKED" && (
            <div className="text-right">
              <p className="font-body text-sm font-medium text-text-primary">{metCount}/{totalCount} shart bajarildi</p>
              <div className="w-32 h-2 bg-border rounded-full mt-1">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        {status === "LOCKED" && (
          <div className="space-y-3">
            <p className="font-body text-sm font-medium text-text-primary">Bajarish shartlari:</p>
            {requirements.map((req) => (
              <div key={req.label} className="flex items-center justify-between rounded-input border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${req.met ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-body text-sm text-text-secondary">{req.label}</span>
                </div>
                <div className="text-right">
                  <span className={`font-body text-sm font-medium ${req.met ? "text-green-600" : "text-text-muted"}`}>
                    {typeof req.current === "number" ? req.current : req.current}
                  </span>
                  <span className="font-body text-sm text-text-muted mx-1">/</span>
                  <span className="font-body text-sm text-text-muted">{req.target}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "LOCKED" && !bioLinkVerified && bioLinkRequired && (
          <Alert tone="info">
            Bio link tekshirish uchun admin tomonidan ko'rib chiqilmoqda. Profil sahifasida sofsavdo.com havolasini qo'shing.
          </Alert>
        )}

        {status === "UNLOCKED" && (
          <Alert tone="success">
            Barcha shartlar bajarildi! Bonusni pul yechish orqali chiqarib olishingiz mumkin.
          </Alert>
        )}

        {status === "EXPIRED" && (
          <Alert tone="error">
            Bonus muddati tugagan. Keyingi kampaniyalarda qatnashib yangi bonus olish imkoniyatini qo'lga kiritishingiz mumkin.
          </Alert>
        )}
      </div>
    </Card>
  );
}
