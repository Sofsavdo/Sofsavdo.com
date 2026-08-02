"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, TextField, cn } from "@sofsavdo/ui";
import { HeartHandshake } from "lucide-react";
import { useFundStats, useFundLeaderboard, useContributeToFund } from "@/services/creator-fund";
import { useWalletBalance } from "@/services/finance";
import { fundContributionSchema, type FundContributionInput } from "@/lib/schemas";
import { ApiError } from "@/lib/api";

export default function CreatorFundPage() {
  const statsQuery = useFundStats();
  const leaderboardQuery = useFundLeaderboard();
  const balanceQuery = useWalletBalance();
  const contribute = useContributeToFund();
  const form = useForm<FundContributionInput>({ resolver: zodResolver(fundContributionSchema) });

  const isLoading = statsQuery.isLoading || leaderboardQuery.isLoading;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const stats = statsQuery.data;
  const top = leaderboardQuery.data?.top ?? [];
  const me = leaderboardQuery.data?.me ?? null;
  const meInTop = me ? top.some((r) => r.creatorId === me.creatorId) : false;
  const balance = balanceQuery.data;

  async function onContribute(values: FundContributionInput) {
    await contribute.mutateAsync({ amountMinor: Math.round(Number(values.amount) * 100), message: values.message });
    form.reset();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-text-primary">
          <HeartHandshake className="size-6 text-accent" /> Creator Fund
        </h1>
        <p className="mt-1 font-body text-sm text-text-secondary">
          Balansingizdan bir qismini hamjamiyat fondiga ulashing — boshqa creatorlar bilan birga o&apos;sing.
        </p>
      </div>

      <Card className="flex flex-col gap-4 border-accent/20 bg-gradient-to-br from-surface to-bg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm text-text-secondary">Platforma bo&apos;yicha jami fond</p>
          <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary md:text-4xl">
            {formatMoneyMinor(stats?.totalMinor ?? 0, stats?.currency)}
          </p>
        </div>
        <div>
          <p className="font-body text-sm text-text-secondary">Sizning ulushingiz</p>
          <p className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-text-primary">
            {formatMoneyMinor(stats?.myTotalMinor ?? 0, stats?.currency)}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Hissa qo&apos;shish</CardTitle>
          {balance ? (
            <p className="font-body text-sm text-text-secondary">
              Mavjud balans: <strong>{formatMoneyMinor(balance.availableMinor, balance.currency)}</strong>
            </p>
          ) : null}
        </CardHeader>

        <form onSubmit={form.handleSubmit(onContribute)} className="flex flex-col gap-4" noValidate>
            <TextField label="Miqdor (so'm)" type="number" error={form.formState.errors.amount?.message} {...form.register("amount")} />
            <TextField
              label="Xabar (ixtiyoriy)"
              placeholder="Omad tilaymiz!"
              error={form.formState.errors.message?.message}
              {...form.register("message")}
            />

            {contribute.isError ? <Alert tone="error">{(contribute.error as ApiError).message}</Alert> : null}
            {contribute.isSuccess ? <Alert tone="success">Rahmat! Hissangiz qabul qilindi.</Alert> : null}

            <Button type="submit" disabled={contribute.isPending} className="w-fit">
              {contribute.isPending ? "Yuborilmoqda..." : "Hissa qo'shish"}
            </Button>
          </form>
      </Card>

      <div>
        <h2 className="mb-2 font-heading text-lg font-semibold text-text-primary">Eng saxiy creatorlar</h2>
        {top.length === 0 ? (
          <EmptyState title="Hali hech kim hissa qo'shmagan" description="Birinchi bo'lib fondga hissa qo'shing!" />
        ) : (
          <Card>
            <div className="flex flex-col divide-y divide-border">
              {top.map((entry) => (
                <div
                  key={entry.creatorId}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0",
                    me && entry.creatorId === me.creatorId ? "rounded-input bg-accent/5 px-3" : "",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full font-numeric text-sm font-bold tabular-nums",
                        entry.rank === 1 ? "bg-accent text-white" : entry.rank <= 3 ? "bg-accent/15 text-accent" : "bg-bg text-text-muted",
                      )}
                    >
                      {entry.rank}
                    </span>
                    <p className="font-body text-sm font-medium text-text-primary">
                      {entry.displayName}
                      {me && entry.creatorId === me.creatorId ? (
                        <Badge tone="accent" className="ml-2">
                          Siz
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                    {formatMoneyMinor(entry.totalMinor)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {me && !meInTop ? (
          <Card className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg font-numeric text-sm font-bold tabular-nums text-text-muted">
                  {me.rank}
                </span>
                <p className="font-body text-sm font-medium text-text-primary">{me.displayName}</p>
              </div>
              <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">{formatMoneyMinor(me.totalMinor)}</span>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
