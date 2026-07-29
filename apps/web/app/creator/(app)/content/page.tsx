"use client";

import Link from "next/link";
import { EmptyState, Skeleton, Badge, Card, StatTile } from "@sofsavdo/ui";
import { useMyCampaigns } from "@/services/campaigns";
import { useContent } from "@/services/content";
import { useMyContents, useMyContentDashboardCounts } from "@/services/content";
import { ContentCard } from "@/components/creator/ContentCard";
import { realContentStatusMeta } from "@/lib/status";
import type { ContentStatus } from "@sofsavdo/types";

const ELIGIBLE_STATUSES = new Set(["CONTENT_REQUIRED", "CONTENT_REVIEW", "ACTIVE", "COMPLETED"]);
const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

const DASHBOARD_STATUSES: ContentStatus[] = ["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "EXPIRED"];

function RealContentPage() {
  const contentsQuery = useMyContents();
  const countsQuery = useMyContentDashboardCounts();

  if (contentsQuery.isLoading || countsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const contents = contentsQuery.data ?? [];
  const counts = countsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Kontentlar</h1>
        <p className="font-body text-sm text-text-secondary">
          Kampaniyalaringiz uchun content yarating, tahrirlang va tekshiruv holatini kuzating.
        </p>
      </div>

      {counts ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DASHBOARD_STATUSES.map((s) => (
            <StatTile key={s} label={realContentStatusMeta[s].label} value={String(counts[s])} />
          ))}
        </div>
      ) : null}

      {contents.length === 0 ? (
        <EmptyState
          title="Hozircha content yo'q"
          description="Tasdiqlangan kampaniyangiz sahifasidan yangi content yarating."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contents.map((c) => (
            <Link key={c.id} href={`/creator/content/${c.id}`}>
              <Card className="cursor-pointer transition hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-body text-xs text-text-muted">{c.campaign.name}</p>
                    <p className="font-body text-sm font-medium text-text-primary">{c.caption || "Caption kiritilmagan"}</p>
                  </div>
                  <Badge tone={realContentStatusMeta[c.status].tone}>{realContentStatusMeta[c.status].label}</Badge>
                </div>
                {c.changesRequestedReason ? (
                  <p className="mt-2 font-body text-xs text-warning">O&apos;zgartirish so&apos;raldi: {c.changesRequestedReason}</p>
                ) : null}
                {c.rejectionReason ? <p className="mt-2 font-body text-xs text-error">Rad etildi: {c.rejectionReason}</p> : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MockContentPage() {
  const myCampaignsQuery = useMyCampaigns();
  const contentQuery = useContent();

  const isLoading = myCampaignsQuery.isLoading || contentQuery.isLoading;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const eligible = (myCampaignsQuery.data ?? []).filter((cc) => ELIGIBLE_STATUSES.has(cc.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Kontentlar</h1>
        <p className="font-body text-sm text-text-secondary">
          Faol kampaniyalaringiz uchun kontent yuklang va tekshiruv holatini kuzating.
        </p>
      </div>

      {eligible.length === 0 ? (
        <EmptyState
          title="Hozircha kontent talab qilinmaydi"
          description="Kampaniya faollashgach yoki kontent talab qilingach, shu yerda ko'rinadi."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {eligible.map((cc) => (
            <ContentCard
              key={cc.id}
              creatorCampaign={cc}
              content={(contentQuery.data ?? []).find((c) => c.creatorCampaignId === cc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  return USE_REAL_API ? <RealContentPage /> : <MockContentPage />;
}
