/**
 * Daromad (Earnings) Page
 * 
 * Combined balance and payout page showing available balance, pending earnings,
 * payout methods, and withdrawal functionality.
 */

'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, SelectField, Skeleton, StatTile, TextField } from "@sofsavdo/ui";
import {
  useWalletBalance,
  useWalletTransactions,
  useCreatePayoutMethod,
  useDeletePayoutMethod,
  usePayoutsMine,
  useRealPayoutMethods,
  useRequestRealPayout,
  useCancelRealPayout,
} from "@/services/finance";
import { payoutMethodSchema, payoutRequestSchema, type PayoutMethodInput, type PayoutRequestInput } from "@/lib/schemas";
import { realPayoutStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api";

const LEDGER_LABELS: Record<string, string> = {
  ACCRUAL: 'Hisoblandi',
  REVERSAL: 'Bekor qilindi',
  PAYOUT: 'Yechib olindi',
};

export default function EarningsPage() {
  const balanceQuery = useWalletBalance();
  const transactionsQuery = useWalletTransactions();
  const methodsQuery = useRealPayoutMethods();
  const payoutsQuery = usePayoutsMine();
  const createMethod = useCreatePayoutMethod();
  const deleteMethod = useDeletePayoutMethod();
  const requestPayout = useRequestRealPayout();
  const cancelPayout = useCancelRealPayout();
  const [showAddMethod, setShowAddMethod] = useState(false);

  const methodForm = useForm<PayoutMethodInput>({ resolver: zodResolver(payoutMethodSchema) });
  const requestForm = useForm<PayoutRequestInput>({ resolver: zodResolver(payoutRequestSchema) });

  const isLoading = balanceQuery.isLoading || methodsQuery.isLoading || payoutsQuery.isLoading;

  if (isLoading) {
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
  const methods = methodsQuery.data ?? [];
  const payouts = payoutsQuery.data?.items ?? [];

  async function onAddMethod(values: PayoutMethodInput) {
    await createMethod.mutateAsync({ type: "CARD", cardNumber: values.cardNumber, cardHolder: values.cardHolder });
    methodForm.reset();
    setShowAddMethod(false);
  }

  async function onRequestPayout(values: PayoutRequestInput) {
    await requestPayout.mutateAsync({
      amountMinor: Math.round(Number(values.amount) * 100),
      payoutMethodId: values.payoutMethodId,
    });
    requestForm.reset();
  }

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
          {canRequestPayout && methods.length > 0 ? (
            <Button size="lg" onClick={() => document.getElementById('payout-request')?.scrollIntoView({ behavior: 'smooth' })}>
              Pul yechish
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

      {/* Payout Methods */}
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>To&apos;lov usullari</CardTitle>
        </CardHeader>
        {methods.length === 0 ? (
          <p className="mb-3 font-body text-sm text-text-muted">Hali to&apos;lov usuli qo&apos;shilmagan.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-input border border-border px-3 py-2 font-body text-sm">
                <span className="text-text-primary">{m.label}</span>
                <div className="flex items-center gap-2">
                  {m.isDefault ? <Badge tone="accent">Asosiy</Badge> : null}
                  <Button size="sm" variant="ghost" onClick={() => deleteMethod.mutate(m.id)}>
                    O&apos;chirish
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showAddMethod ? (
          <form onSubmit={methodForm.handleSubmit(onAddMethod)} className="flex flex-col gap-3 border-t border-border pt-4" noValidate>
            <TextField
              label="Karta raqami"
              placeholder="8600 0000 0000 0000"
              error={methodForm.formState.errors.cardNumber?.message}
              {...methodForm.register("cardNumber")}
            />
            <TextField
              label="Karta egasi"
              placeholder="MALIKA YUSUPOVA"
              error={methodForm.formState.errors.cardHolder?.message}
              {...methodForm.register("cardHolder")}
            />
            {createMethod.isError ? <Alert tone="error">Qo&apos;shishda xatolik yuz berdi.</Alert> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={createMethod.isPending}>
                {createMethod.isPending ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddMethod(false)}>
                Bekor qilish
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAddMethod(true)}>
            To&apos;lov usuli qo&apos;shish
          </Button>
        )}
      </Card>

      {/* Payout Request */}
      <Card id="payout-request">
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Payout so&apos;rash</CardTitle>
          <p className="font-body text-sm text-text-secondary">
            Mavjud balans: <strong>{formatMoneyMinor(b.availableMinor, b.currency)}</strong> · Minimal:{" "}
            {formatMoneyMinor(b.minimumPayoutMinor, b.currency)}
          </p>
        </CardHeader>

        {methods.length === 0 ? (
          <Alert tone="info">Avval to&apos;lov usulini qo&apos;shing.</Alert>
        ) : (
          <form onSubmit={requestForm.handleSubmit(onRequestPayout)} className="flex flex-col gap-4" noValidate>
            <TextField
              label="Miqdor (so'm)"
              type="number"
              error={requestForm.formState.errors.amount?.message}
              {...requestForm.register("amount")}
            />
            <SelectField
              label="To'lov usuli"
              error={requestForm.formState.errors.payoutMethodId?.message}
              {...requestForm.register("payoutMethodId")}
            >
              <option value="">Tanlang</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </SelectField>

            {requestPayout.isError ? (
              <Alert tone="error">{(requestPayout.error as ApiError).message}</Alert>
            ) : null}
            {requestPayout.isSuccess ? <Alert tone="success">Payout so&apos;rovingiz yuborildi.</Alert> : null}

            <Button type="submit" disabled={requestPayout.isPending} className="w-fit">
              {requestPayout.isPending ? "Yuborilmoqda..." : "So'rov yuborish"}
            </Button>
          </form>
        )}
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout tarixi</CardTitle>
        </CardHeader>
        {payouts.length === 0 ? (
          <EmptyState title="Hali payout so'rovi yo'q" />
        ) : (
          <ul className="divide-y divide-border">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                    {formatMoneyMinor(p.amountMinor, p.currency)}
                  </p>
                  <p className="font-body text-xs text-text-muted">
                    {p.payoutMethodLabel} · {new Date(p.requestedAt).toLocaleDateString("uz-UZ")}
                  </p>
                  {p.status === "REJECTED" && p.rejectionReason ? (
                    <p className="mt-1 font-body text-xs text-error">{p.rejectionReason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={realPayoutStatusMeta[p.status].tone}>{realPayoutStatusMeta[p.status].label}</Badge>
                  {p.status === "REQUESTED" ? (
                    <Button size="sm" variant="ghost" onClick={() => cancelPayout.mutate(p.id)}>
                      Bekor qilish
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Transactions */}
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
                    {t.commission.orderPublicToken ?? "Fidem"} · {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
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
