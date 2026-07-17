"use client";

import { use } from "react";
import Link from "next/link";
import { ExternalLink, LayoutTemplate } from "lucide-react";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, SelectField, Skeleton, StatusBadge } from "@rosti/ui";
import { useAdminCampaigns } from "@/services/admin/campaigns";
import { useAdminOffer, useAdminProduct, useUpdateOffer } from "@/services/admin/catalog";
import { OfferForm } from "@/components/admin/OfferForm";
import { offerStatusMeta, campaignStatusMeta } from "@/lib/status";
import type { OfferStatus } from "@rosti/types";

const OFFER_STATUSES: OfferStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"];

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const offerQuery = useAdminOffer(id);
  const updateOffer = useUpdateOffer();
  const campaignsQuery = useAdminCampaigns();
  const offer = offerQuery.data;
  const productQuery = useAdminProduct(offer?.productId ?? "");

  if (offerQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!offer) return <Alert tone="error">Offer topilmadi.</Alert>;

  const relatedCampaigns = (campaignsQuery.data ?? []).filter((c) => c.offer.id === offer.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/products" className="hover:text-text-primary">
          Products
        </Link>
        <span>/</span>
        <Link href={`/admin/products/${offer.productId}`} className="hover:text-text-primary">
          {productQuery.data?.name ?? "Product"}
        </Link>
        <span>/</span>
        <span className="text-text-primary">{offer.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-text-primary">{offer.name}</h1>
          <StatusBadge tone={offerStatusMeta[offer.status].tone} label={offerStatusMeta[offer.status].label} />
        </div>
        <div className="flex items-center gap-2">
          <SelectField
            label=""
            className="h-9 w-40"
            value={offer.status}
            onChange={(e) => updateOffer.mutate({ id: offer.id, patch: { status: e.target.value as OfferStatus } })}
          >
            {OFFER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {offerStatusMeta[s].label}
              </option>
            ))}
          </SelectField>
          <Button asChild variant="outline" size="sm">
            <Link href={`/o/${offer.slug}`} target="_blank">
              <ExternalLink className="mr-1.5 size-4" /> Ko&apos;rish
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/admin/landings/${offer.id}`}>
              <LayoutTemplate className="mr-1.5 size-4" /> Landing builder
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Narx / {formatMoneyMinor(offer.priceMinor, offer.currency)}</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {offer.variants.map((v) => (
            <Badge key={v.id} tone="neutral">
              {v.name}: {formatMoneyMinor(v.priceMinor, offer.currency)}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shu offer bilan ishlayotgan Campaignlar</CardTitle>
        </CardHeader>
        {relatedCampaigns.length === 0 ? (
          <p className="font-body text-sm text-text-muted">
            Hali kampaniya yaratilmagan.{" "}
            <Link href={`/admin/campaigns/new?offerId=${offer.id}`} className="text-accent underline">
              Campaign yaratish
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {relatedCampaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <Link href={`/admin/campaigns/${c.id}`} className="font-body text-sm text-text-primary hover:text-accent">
                  {c.name}
                </Link>
                <Badge tone={campaignStatusMeta[c.status].tone}>{campaignStatusMeta[c.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mx-auto max-w-2xl">
        <OfferForm existing={offer} />
      </div>
    </div>
  );
}
