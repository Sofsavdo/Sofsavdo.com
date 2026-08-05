"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@sofsavdo/ui";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  useApproveCompetitionParticipant,
  useCompetitionParticipants,
  useRefreshCompetitionParticipantViewCount,
  useRejectCompetitionParticipant,
  useUpdateCompetitionParticipantViewCount,
} from "@/services/admin/competitions";
import type { ApiError, CompetitionParticipantAdmin } from "@/lib/api/admin";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "hozirgina";
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.floor(hours / 24)} kun oldin`;
}

function ViewCountEditor({ competitionId, participant }: { competitionId: string; participant: CompetitionParticipantAdmin }) {
  const [value, setValue] = useState(String(participant.viewCount));
  const update = useUpdateCompetitionParticipantViewCount(competitionId);
  const refresh = useRefreshCompetitionParticipantViewCount(competitionId);

  // Keep the input in sync after a successful refresh — otherwise the fetched number sits in
  // `participant.viewCount` (the new prop) while this field still shows what the admin typed
  // before clicking "Yangilash".
  useEffect(() => {
    setValue(String(participant.viewCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.viewCount]);

  function onSave() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    update.mutate({ participantId: participant.id, viewCount: parsed });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <TextField
          label="Ko'rishlar"
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28"
        />
        <Button size="sm" variant="outline" onClick={onSave} disabled={update.isPending || value === String(participant.viewCount)}>
          {update.isPending ? "..." : "Saqlash"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh.mutate(participant.id)}
          disabled={refresh.isPending}
          aria-label="Instagram'dan yangilash"
        >
          <RefreshCw className={refresh.isPending ? "size-3.5 animate-spin" : "size-3.5"} />
        </Button>
      </div>
      {participant.viewCountUpdatedAt ? (
        <span className="font-body text-xs text-text-muted">
          {participant.viewCountSource === "AUTO" ? "Instagram'dan" : "Qo'lda"} yangilangan — {timeAgo(participant.viewCountUpdatedAt)}
        </span>
      ) : null}
      {refresh.isError ? <span className="font-body text-xs text-error">{(refresh.error as ApiError).message}</span> : null}
    </div>
  );
}

function RejectForm({ onReject, isPending }: { onReject: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Rad etish
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <TextField label="Rad etish sababi" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: video sifatsiz, ovoz yo'q" />
      <Button size="sm" disabled={reason.trim().length < 5 || isPending} onClick={() => onReject(reason.trim())}>
        {isPending ? "Yuborilmoqda..." : "Tasdiqlash"}
      </Button>
    </div>
  );
}

export function CompetitionParticipantsPanel({ competitionId }: { competitionId: string }) {
  const query = useCompetitionParticipants(competitionId);
  const approve = useApproveCompetitionParticipant(competitionId);
  const reject = useRejectCompetitionParticipant(competitionId);

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;

  const participants = query.data ?? [];
  const pending = participants.filter((p) => p.status === "PENDING");
  const approved = participants.filter((p) => p.status === "APPROVED");
  const rejected = participants.filter((p) => p.status === "REJECTED");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ishtirokchilar</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 font-body text-sm font-semibold text-text-primary">Ko&apos;rib chiqilmoqda ({pending.length})</p>
          {pending.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Yangi ariza yo&apos;q.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-body text-sm font-medium text-text-primary">{p.creatorName}</span>
                    {p.videoUrl ? (
                      <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-body text-xs text-accent underline">
                        Videoni ko&apos;rish <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                      {approve.isPending ? "..." : "Tasdiqlash"}
                    </Button>
                    <RejectForm isPending={reject.isPending} onReject={(reason) => reject.mutate({ participantId: p.id, reason })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 font-body text-sm font-semibold text-text-primary">Tasdiqlangan — reyting ({approved.length})</p>
          {approved.length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hali tasdiqlangan ishtirokchi yo&apos;q.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {approved
                .slice()
                .sort((a, b) => b.viewCount - a.viewCount)
                .map((p, i) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg font-numeric text-xs font-bold tabular-nums text-text-muted">{i + 1}</span>
                      <div>
                        <p className="font-body text-sm font-medium text-text-primary">{p.creatorName}</p>
                        {p.videoUrl ? (
                          <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="font-body text-xs text-accent underline">
                            Video
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <ViewCountEditor competitionId={competitionId} participant={p} />
                  </div>
                ))}
            </div>
          )}
        </div>

        {rejected.length > 0 ? (
          <div>
            <p className="mb-2 font-body text-sm font-semibold text-text-primary">Rad etilgan ({rejected.length})</p>
            <div className="flex flex-col gap-2">
              {rejected.map((p) => (
                <div key={p.id} className="rounded-input border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body text-sm font-medium text-text-primary">{p.creatorName}</span>
                    <Badge tone="error">Rad etilgan</Badge>
                  </div>
                  {p.reviewNote ? <p className="mt-1 font-body text-xs text-text-muted">Sabab: {p.reviewNote}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {approve.isError ? <Alert tone="error">Tasdiqlashda xatolik yuz berdi.</Alert> : null}
        {reject.isError ? <Alert tone="error">Rad etishda xatolik yuz berdi.</Alert> : null}
      </div>
    </Card>
  );
}
