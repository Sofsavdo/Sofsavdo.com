"use client";

import Link from "next/link";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Button, Card, CardHeader, CardTitle, Skeleton, StatTile } from "@rosti/ui";
import { useBalance } from "@/services/finance";

export default function BalancePage() {
  const query = useBalance();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <Alert tone="error">Balansni yuklashda xatolik yuz berdi.</Alert>;
  }

  const b = query.data;
  const canRequestPayout = b.availableMinor >= b.minimumPayoutMinor;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Balans</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile label="Kutilmoqda" value={formatMoneyMinor(b.pendingMinor)} />
        <StatTile label="Tasdiqlangan" value={formatMoneyMinor(b.approvedMinor)} />
        <StatTile label="Mavjud (yechib olish uchun)" value={formatMoneyMinor(b.availableMinor)} />
        <StatTile label="Payout so'ralgan" value={formatMoneyMinor(b.payoutRequestedMinor)} />
        <StatTile label="To'langan (jami)" value={formatMoneyMinor(b.paidMinor)} />
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Pul yechib olish</CardTitle>
        </CardHeader>
        <p className="mb-4 font-body text-sm text-text-secondary">
          Minimal so&apos;rov miqdori: <strong>{formatMoneyMinor(b.minimumPayoutMinor)}</strong>. Payout faqat
          &quot;Mavjud&quot; balansdan so&apos;raladi.
        </p>
        {!canRequestPayout ? (
          <Alert tone="warning" className="mb-3">
            Mavjud balansingiz minimal payout miqdoridan kam. Yangi sotuvlar tasdiqlangach so&apos;rov yubora olasiz.
          </Alert>
        ) : null}
        {canRequestPayout ? (
          <Button asChild>
            <Link href="/creator/payouts">Payout so&apos;rash</Link>
          </Button>
        ) : (
          <Button disabled>Payout so&apos;rash</Button>
        )}
      </Card>
    </div>
  );
}
