"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreatorCampaignStatus } from "@sofsavdo/types";
import { Badge, EmptyState, Skeleton, cn } from "@sofsavdo/ui";
import { useMyCampaigns } from "@/services/campaigns";
import { creatorCampaignStatusMeta } from "@/lib/status";

const STATUS_ACTION: Partial<Record<CreatorCampaignStatus, { label: string; href: string }>> = {
  ACTIVE: { label: "Promo materiallar", href: "/creator/promo-materials" },
  COMPLETED: { label: "Sotuvlarni ko'rish", href: "/creator/sales" },
};

export default function MyCampaignsPage() {
  const query = useMyCampaigns();
  const [filter, setFilter] = useState<CreatorCampaignStatus | "ALL">("ALL");

  const statusesPresent = useMemo(
    () => Array.from(new Set((query.data ?? []).map((cc) => cc.status))),
    [query.data],
  );

  const filtered = (query.data ?? []).filter((cc) => filter === "ALL" || cc.status === filter);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Mening kampaniyalarim</h1>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={cn(
            "rounded-full border px-3 py-1 font-body text-sm",
            filter === "ALL" ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary",
          )}
        >
          Barchasi ({query.data?.length ?? 0})
        </button>
        {statusesPresent.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-full border px-3 py-1 font-body text-sm",
              filter === status ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary",
            )}
          >
            {creatorCampaignStatusMeta[status].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Bu holatda kampaniya yo'q"
          description="Boshqa filtrni tanlang yoki katalogdan yangi kampaniya tanlang."
        />
      ) : (
        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          {filtered.map((cc) => {
            // Application-lifecycle statuses (incl. CHANGES_REQUESTED's edit+resubmit loop) are
            // managed on the campaign detail page's application panel.
            const action =
              STATUS_ACTION[cc.status] ??
              (["APPLIED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(cc.status)
                ? { label: cc.status === "CHANGES_REQUESTED" ? "Arizani tahrirlash" : "Arizani ko'rish", href: `/creator/campaigns/${cc.campaignId}` }
                : undefined);
            return (
              <div key={cc.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-body text-sm font-medium text-text-primary">{cc.campaign.name}</p>
                  <p className="font-body text-xs text-text-muted">
                    {cc.campaign.category} · {new Date(cc.joinedAt).toLocaleDateString("uz-UZ")} sanasida qo&apos;shilgan
                  </p>
                  {cc.status === "REJECTED" && cc.rejectionReason ? (
                    <p className="mt-1 font-body text-xs text-error">{cc.rejectionReason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={creatorCampaignStatusMeta[cc.status].tone}>{creatorCampaignStatusMeta[cc.status].label}</Badge>
                  {action ? (
                    <Link href={action.href} className="font-body text-sm text-accent underline">
                      {action.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
