import Link from "next/link";
import { Badge } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";

// Shared between the homepage's FeaturedProducts section (Phase C) and /catalog (Phase E) — both
// surfaces show the same kind of card for the same kind of narrow, public-safe offer projection,
// so this is the one place that rendering lives, not two copies drifting apart.
export interface ProductCardOffer {
  id: string;
  slug: string;
  name: string;
  headline: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
}

export function ProductCard({ offer }: { offer: ProductCardOffer }) {
  const hasDiscount = offer.compareAtPriceMinor != null && offer.compareAtPriceMinor > offer.priceMinor;
  return (
    <Link
      href={`/o/${offer.slug}`}
      className="group block overflow-hidden rounded-card border border-border bg-surface shadow-card transition-shadow hover:shadow-elevated"
    >
      <div className="aspect-square w-full overflow-hidden bg-surface-muted">
        {offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- same convention as CampaignCard/ContentCard: image hosts are storage-driver-dependent (local/S3/R2), not registered in next.config.ts's image remotePatterns.
          <img
            src={offer.imageUrl}
            alt={offer.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-heading text-sm text-text-muted">
            {offer.name}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-heading text-base font-semibold text-text-primary">{offer.name}</h3>
        <p className="mt-1 line-clamp-2 font-body text-sm text-text-secondary">{offer.headline}</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="font-numeric text-lg font-bold tabular-nums text-accent">
            {formatMoneyMinor(offer.priceMinor, offer.currency)}
          </span>
          {hasDiscount ? (
            <span className="font-numeric text-sm tabular-nums text-text-muted line-through">
              {formatMoneyMinor(offer.compareAtPriceMinor!, offer.currency)}
            </span>
          ) : null}
        </div>
        {hasDiscount ? (
          <Badge tone="accent" className="mt-2">
            Chegirma
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
