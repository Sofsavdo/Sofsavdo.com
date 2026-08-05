"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, EmptyState, Skeleton, TextField, cn } from "@sofsavdo/ui";
import { Trophy, UserPlus } from "lucide-react";
import { useCompetitionLeaderboard, useMyCompetitions, useJoinCompetition, useSubmitCompetitionVideo } from "@/services/competitions";

function VideoSubmissionForm({ competitionId, rejectionNote }: { competitionId: string; rejectionNote?: string | null }) {
  const [videoUrl, setVideoUrl] = useState("");
  const submit = useSubmitCompetitionVideo();

  return (
    <Card>
      <div className="flex flex-col gap-3">
        {rejectionNote ? (
          <Alert tone="error">
            Oldingi videongiz rad etildi. Sabab: {rejectionNote}
          </Alert>
        ) : null}
        <p className="font-body text-sm text-text-secondary">
          Sofsavdo haqida video tayyorlab, Instagram&apos;ingizga joylang, so&apos;ng havolasini shu yerga yuboring.
        </p>
        <TextField
          label="Instagram video (reels) havolasi"
          type="url"
          placeholder="https://instagram.com/reel/..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <Button
          onClick={() => submit.mutate({ competitionId, videoUrl })}
          disabled={submit.isPending || videoUrl.trim().length === 0}
          className="w-fit"
        >
          {submit.isPending ? "Yuborilmoqda..." : "Yuborish"}
        </Button>
        {submit.isError ? <Alert tone="error">Yuborishda xatolik yuz berdi. Havolani tekshirib qayta urinib ko&apos;ring.</Alert> : null}
      </div>
    </Card>
  );
}

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const competitions = useMyCompetitions();
  const leaderboard = useCompetitionLeaderboard(id);
  const joinCompetition = useJoinCompetition();

  if (leaderboard.isLoading || competitions.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const competition = (competitions.data ?? []).find((c) => c.id === id);
  const isVideoCompetition = competition?.metric === "INSTAGRAM_VIEWS";
  const metricLabel = isVideoCompetition ? "ko'rish" : "ta sotuv";
  const data = leaderboard.data;
  const top = data?.top ?? [];
  const me = data?.me ?? null;
  const meInTop = me ? top.some((r) => r.creatorId === me.creatorId) : false;
  const myParticipant = competition?.myParticipant ?? null;
  const hasJoined = myParticipant?.status === "APPROVED";

  async function handleJoin() {
    try {
      await joinCompetition.mutateAsync(id);
    } catch (error) {
      console.error("Failed to join competition:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/creator/competitions" className="hover:text-text-primary">
          Musobaqalar
        </Link>
        <span>/</span>
        <span className="text-text-primary">{competition?.name ?? "Musobaqa"}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
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
        {!isVideoCompetition && !hasJoined && competition?.availability === "LIVE" ? (
          <Button onClick={handleJoin} disabled={joinCompetition.isPending} className="shrink-0">
            <UserPlus className="mr-2 size-4" />
            {joinCompetition.isPending ? "Qo'shilmoqda..." : "Qo'shilish"}
          </Button>
        ) : hasJoined ? (
          <Badge tone="success" className="shrink-0">Qo'shilgan</Badge>
        ) : null}
      </div>

      {isVideoCompetition && myParticipant?.status === "PENDING" ? (
        <Alert tone="info">Videongiz yuborildi — admin ko&apos;rib chiqmoqda. Tasdiqlangach reytingda ko&apos;rinasiz.</Alert>
      ) : null}

      {isVideoCompetition && (!myParticipant || myParticipant.status === "REJECTED") && competition?.availability === "LIVE" ? (
        <VideoSubmissionForm competitionId={id} rejectionNote={myParticipant?.status === "REJECTED" ? myParticipant.reviewNote : null} />
      ) : null}

      {top.length === 0 && !hasJoined ? (
        <EmptyState title="Reyting hali bo'sh" description="Bu musobaqada hali hech kim qatnashmagan — birinchi bo'ling!" />
      ) : top.length === 0 && hasJoined ? (
        <Card>
          <p className="font-body text-sm text-text-secondary">
            Siz musobaqaga qo'shildingiz. {isVideoCompetition ? "Ko'rishlar soni" : "Sotuvlaringiz"} reytingda ko'rinadi.
          </p>
        </Card>
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
                    <p className="font-body text-xs text-text-muted">
                      {entry.ordersCount.toLocaleString("uz-UZ")} {metricLabel}
                    </p>
                  </div>
                </div>
                {!isVideoCompetition ? (
                  <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                    {formatMoneyMinor(entry.commissionMinor)}
                  </span>
                ) : null}
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
                <p className="font-body text-xs text-text-muted">
                  {me.ordersCount.toLocaleString("uz-UZ")} {metricLabel}
                </p>
              </div>
            </div>
            {!isVideoCompetition ? (
              <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">{formatMoneyMinor(me.commissionMinor)}</span>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
