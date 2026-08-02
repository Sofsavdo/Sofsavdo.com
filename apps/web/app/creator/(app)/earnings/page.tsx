/**
 * Daromad (Earnings) Page
 * 
 * Earnings page showing available balance, pending earnings, and withdrawal.
 * Uses existing wallet API instead of non-existent v2 endpoints.
 */

'use client';

import Link from 'next/link';
import { formatMoneyMinor } from '@sofsavdo/types';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, StatTile } from '@sofsavdo/ui';
import { useWalletBalance, useWalletTransactions } from '@/services/finance';

const LEDGER_LABELS: Record<string, string> = {
  ACCRUAL: 'Hisoblandi',
  REVERSAL: 'Bekor qilindi',
  PAYOUT: 'Yechib olindi',
};

export default function EarningsPage() {
  const balanceQuery = useWalletBalance();
  const transactionsQuery = useWalletTransactions();

  if (balanceQuery.isLoading) {
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

  if (balanceQuery.isError || !balanceQuery.data) {
    return <Alert tone="error">Daromad ma'lumotlarini yuklab bo'lmadi.</Alert>;
  }

  const b = balanceQuery.data;
  const canRequestPayout = b.availableMinor >= b.minimumPayoutMinor;
  const transactions = transactionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Balans</h1>

      {/* Hero balance card */}
      <Card className="border-accent/20 bg-gradient-to-br from-surface to-bg">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-body text-sm text-text-secondary">Mavjud (yechib olish uchun)</p>
            <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary md:text-4xl">
              {formatMoneyMinor(b.availableMinor, b.currency)}
            </p>
          </div>
          {canRequestPayout ? (
            <Button asChild size="lg">
              <Link href="/creator/payouts">Pul yechish</Link>
            </Button>
          ) : (
            <Button size="lg" disabled>
              Pul yechish
            </Button>
          )}
        </div>
        <p className="mt-4 border-t border-border pt-3 font-body text-sm text-text-secondary">
          Minimal so&apos;rov miqdori: <strong>{formatMoneyMinor(b.minimumPayoutMinor, b.currency)}</strong>. Payout
          faqat &quot;Mavjud&quot; balansdan so&apos;raladi.
        </p>
        {!canRequestPayout ? (
          <Alert tone="warning" className="mt-3">
            Mavjud balansingiz minimal payout miqdoridan kam. Yangi komissiyalar tasdiqlangach so&apos;rov yubora
            olasiz.
          </Alert>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Kutilmoqda" value={formatMoneyMinor(b.pendingMinor, b.currency)} />
        <StatTile label="Payout jarayonida" value={formatMoneyMinor(b.lockedMinor, b.currency)} />
        <StatTile label="To'langan (jami)" value={formatMoneyMinor(b.paidMinor, b.currency)} />
        <StatTile label="Bekor qilingan" value={formatMoneyMinor(b.reversedMinor, b.currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tranzaksiyalar</CardTitle>
        </CardHeader>
        {transactions.length === 0 ? (
          <EmptyState title="Hali tranzaksiya yo'q" />
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                    {formatMoneyMinor(t.amountMinor, b.currency)}
                  </p>
                  <p className="font-body text-xs text-text-muted">
                    {t.commission.orderPublicToken} · {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                  </p>
                  {t.reason ? <p className="mt-1 font-body text-xs text-text-muted">{t.reason}</p> : null}
                </div>
                <Badge tone={t.type === 'ACCRUAL' ? 'success' : t.type === 'REVERSAL' ? 'error' : 'info'}>
                  {LEDGER_LABELS[t.type] ?? t.type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
