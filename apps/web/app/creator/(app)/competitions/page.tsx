"use client";

import Link from "next/link";
import { Award, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton } from "@sofsavdo/ui";
import { competitionAvailabilityMeta } from "@/lib/status";
import { useMyCompetitions, useJoinCompetition } from "@/services/competitions";
import { PrizeBreakdown } from "@/components/creator/PrizeBreakdown";

export default function CompetitionsPage() {
  const competitions = useMyCompetitions();

  if (competitions.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const items = competitions.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Musobaqalar</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">Vaqtga bog&apos;liq motivatsion musobaqalarda qatnashing va sovg&apos;alar yutib oling.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Faol musobaqa yo'q" description="Hozircha faol yoki rejalashtirilgan musobaqa mavjud emas." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((c) => {
            const needsAction = c.availability === "LIVE" && (!c.myParticipant || c.myParticipant.status === "REJECTED");
            return (
              // The whole card links to the detail page regardless of participation status —
              // previously only the "join"/"submit video" button was a link, so once a creator
              // had joined or submitted (status PENDING/APPROVED), the card became a dead end with
              // no way to reach the leaderboard or their own submission status again.
              <Link key={c.id} href={`/creator/competitions/${c.id}`} className="block h-full">
                <Card className="flex h-full flex-col gap-2 transition-colors hover:border-accent">
                  <CardHeader className="flex-col items-start gap-1">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="size-4 text-accent" /> {c.name}
                    </CardTitle>
                    <span
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 font-body text-xs font-medium ${
                        c.availability === "LIVE" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                      }`}
                    >
                      {competitionAvailabilityMeta[c.availability].label}
                    </span>
                  </CardHeader>
                  {c.description ? <p className="font-body text-sm text-text-secondary">{c.description}</p> : null}
                  {c.prizeDescription ? <PrizeBreakdown prizeDescription={c.prizeDescription} /> : null}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="font-body text-xs text-text-muted">
                      {new Date(c.startAt).toLocaleDateString("uz-UZ")} — {new Date(c.endAt).toLocaleDateString("uz-UZ")}
                    </p>
                    {needsAction ? (
                      <Button size="sm" className="pointer-events-none shrink-0">
                        <UserPlus className="mr-2 size-4" />
                        {c.metric === "INSTAGRAM_VIEWS" ? "Video yuborish" : "Qo'shilish"}
                      </Button>
                    ) : c.myParticipant?.status === "PENDING" ? (
                      <Badge tone="warning" className="shrink-0">Ko&apos;rib chiqilmoqda</Badge>
                    ) : c.myParticipant?.status === "APPROVED" ? (
                      <Badge tone="success" className="shrink-0">Qo&apos;shilgan</Badge>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
