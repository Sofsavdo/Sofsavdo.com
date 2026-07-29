"use client";

import { use } from "react";
import Link from "next/link";
import { Alert, Button, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { Archive, CheckCircle2, Send } from "lucide-react";
import { useAdminCompetition, useArchiveCompetition, useCompleteCompetition, usePublishCompetition } from "@/services/admin/competitions";
import { CompetitionForm } from "@/components/admin/CompetitionForm";
import { competitionStatusMeta, competitionAvailabilityMeta } from "@/lib/status";
import type { CompetitionStatus } from "@/lib/api/admin";

// Mirrors the Landing builder page's ALLOWED_NEXT_ACTIONS convention — a UX convenience only, the
// server re-checks every transition regardless (see CompetitionsService's own transition matrix).
const ALLOWED_NEXT_ACTIONS: Record<CompetitionStatus, Array<"publish" | "complete" | "archive">> = {
  DRAFT: ["publish", "archive"],
  ACTIVE: ["complete", "archive"],
  COMPLETED: ["archive"],
  ARCHIVED: [],
};

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useAdminCompetition(id);
  const publish = usePublishCompetition(id);
  const complete = useCompleteCompetition(id);
  const archive = useArchiveCompetition(id);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const competition = query.data;
  if (!competition) return <Alert tone="error">Musobaqa topilmadi.</Alert>;

  const nextActions = ALLOWED_NEXT_ACTIONS[competition.status];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/competitions" className="hover:text-text-primary">
          Musobaqalar
        </Link>
        <span>/</span>
        <span className="text-text-primary">{competition.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words font-heading text-2xl font-bold text-text-primary">{competition.name}</h1>
          <StatusBadge tone={competitionStatusMeta[competition.status].tone} label={competitionStatusMeta[competition.status].label} />
          <StatusBadge tone={competitionAvailabilityMeta[competition.availability].tone} label={competitionAvailabilityMeta[competition.availability].label} />
        </div>
        <div className="flex items-center gap-2">
          {nextActions.includes("publish") ? (
            <Button variant="outline" size="sm" disabled={publish.isPending} onClick={() => publish.mutate()}>
              <Send className="mr-1.5 size-4" /> E&apos;lon qilish
            </Button>
          ) : null}
          {nextActions.includes("complete") ? (
            <Button variant="outline" size="sm" disabled={complete.isPending} onClick={() => complete.mutate()}>
              <CheckCircle2 className="mr-1.5 size-4" /> Yakunlash
            </Button>
          ) : null}
          {nextActions.includes("archive") ? (
            <Button variant="outline" size="sm" disabled={archive.isPending} onClick={() => archive.mutate()}>
              <Archive className="mr-1.5 size-4" /> Arxivlash
            </Button>
          ) : null}
        </div>
      </div>

      <CompetitionForm existing={competition} />
    </div>
  );
}
