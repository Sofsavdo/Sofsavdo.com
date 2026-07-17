"use client";

import { EmptyState, Skeleton } from "@rosti/ui";
import { useMyCampaigns } from "@/services/campaigns";
import { useContent } from "@/services/content";
import { ContentCard } from "@/components/creator/ContentCard";

const ELIGIBLE_STATUSES = new Set(["CONTENT_REQUIRED", "CONTENT_REVIEW", "ACTIVE", "COMPLETED"]);

export default function ContentPage() {
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
