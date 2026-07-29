"use client";

import { use } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Badge, Card, EmptyState, Skeleton, cn } from "@sofsavdo/ui";
import { Trophy } from "lucide-react";
import { useCompetitionLeaderboard, useMyCompetitions } from "@/services/competitions";

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const competitions = useMyCompetitions();
  const leaderboard = useCompetitionLeaderboard(id);

  if (leaderboard.isLoading || competitions.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const competition = (competitions.data ?? []).find((c) => c.id === id);
  const data = leaderboard.data;
  const top = data?.top ?? [];
  const me = data?.me ?? null;
  const meInTop = me ? top.some((r) => r.creatorId === me.creatorId) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/creator/competitions" className="hover:text-text-primary">
          Musobaqalar
        </Link>
        <span>/</span>
        <span className="text-text-primary">{competition?.name ?? "Musobaqa"}</span>
      </div>

      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-text-primary">
          <Trophy className="size-6 text-accent" /> {competition?.name ?? "Musobaqa"}
        </h1>
        {competition?.description ? <p className="mt-1 font-body text-sm text-text-secondary">{competition.description}</p> : null}
        {competition?.prizeDescription ? (
          <p className="mt-2 rounded-input border border-accent/20 bg-accent/5 p-3 font-body text-sm text-text-primary">
            🏆 {competition.prizeDescription}
          </p>
        ) : null}
      </div>

      {top.length === 0 ? (
        <EmptyState title="Reyting hali bo'sh" description="Bu musobaqada hali hech kim sotuv qilmagan — birinchi bo'ling!" />
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
                      entry.rank === 1
                        ? "bg-accent text-white"
                        : entry.rank <= 3
                          ? "bg-accent/15 text-accent"
                          : "bg-bg text-text-muted",
                    )}
                  >
                    {entry.rank}
                  </span>
                  <div>
                    <p className="font-body text-sm font-medium text-text-primary">
                      {entry.displayName}
                      {me && entry.creatorId === me.creatorId ? (
                        <Badge tone="accent" className="ml-2">
                          Siz
                        </Badge>
                      ) : null}
                    </p>
                    <p className="font-body text-xs text-text-muted">{entry.ordersCount} ta sotuv</p>
                  </div>
                </div>
                <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                  {formatMoneyMinor(entry.commissionMinor)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {me && !meInTop ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg font-numeric text-sm font-bold tabular-nums text-text-muted">
                {me.rank}
              </span>
              <div>
                <p className="font-body text-sm font-medium text-text-primary">{me.displayName}</p>
                <p className="font-body text-xs text-text-muted">{me.ordersCount} ta sotuv</p>
              </div>
            </div>
            <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">{formatMoneyMinor(me.commissionMinor)}</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
