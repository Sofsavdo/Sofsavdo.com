import Link from "next/link";
import type { Campaign } from "@sofsavdo/types";
import { Badge, Card } from "@sofsavdo/ui";
import { Gift, Repeat } from "lucide-react";
import { formatCommission, formatDeadline, platformLabel } from "@/lib/commission-display";

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Go'zallik": "from-pink-200 to-rose-100",
  "Ta'lim": "from-blue-200 to-indigo-100",
  Xizmat: "from-amber-200 to-orange-100",
  "Uy-ro'zg'or": "from-emerald-200 to-teal-100",
};

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const remainingSlots = Math.max(campaign.creatorLimit - campaign.approvedCreatorCount, 0);
  const isFull = remainingSlots === 0;
  // Real mode: the campaign's COVER media item (see CampaignMediaService). Mock mode falls back
  // to the category-gradient placeholder — there is no media data model there.
  const cover = campaign.media?.find((m) => m.mediaRole === "COVER");

  return (
    <Card className="flex flex-col gap-3 p-0 overflow-hidden">
      {cover ? (
        <img src={cover.url} alt={cover.altText ?? campaign.name} className="h-28 w-full object-cover" />
      ) : (
        <div className={`h-28 w-full bg-gradient-to-br ${CATEGORY_GRADIENTS[campaign.category] ?? "from-border to-bg"}`} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          {/* min-w-0 lets line-clamp actually take effect inside a flex item (without it, a flex
              child's intrinsic min-width can exceed its allotted space and it never wraps/clamps
              at all) — a long campaign name previously had no overflow protection and could push
              against or crowd the commission badge. */}
          <div className="min-w-0">
            <p className="font-body text-xs text-text-muted">{campaign.category}</p>
            <h3 className="line-clamp-2 font-heading text-base font-semibold text-text-primary">{campaign.name}</h3>
          </div>
          <Badge tone={isFull ? "neutral" : "accent"} className="shrink-0">
            {isFull ? "To'lgan" : formatCommission(campaign)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {campaign.platforms.map((p) => (
            <Badge key={p} tone="neutral">
              {platformLabel(p)}
            </Badge>
          ))}
          {campaign.barterEnabled ? (
            <Badge tone="info">
              <Repeat className="mr-1 inline size-3" /> Barter
            </Badge>
          ) : null}
          {campaign.freeProduct ? (
            <Badge tone="success">
              <Gift className="mr-1 inline size-3" /> Sovg&apos;a
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 font-body text-xs text-text-muted">
          <span>{formatDeadline(campaign.applicationDeadline)}</span>
          <span>{isFull ? "Joy yo'q" : `${remainingSlots} joy qoldi`}</span>
        </div>

        <Link
          href={`/creator/campaigns/${campaign.id}`}
          className="mt-1 block w-full rounded-button bg-accent py-2 text-center font-body text-sm font-medium text-white hover:bg-accent-hover"
        >
          Batafsil
        </Link>
      </div>
    </Card>
  );
}
