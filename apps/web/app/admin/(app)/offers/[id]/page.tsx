"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Archive, ExternalLink, LayoutTemplate, Pause, Play } from "lucide-react";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { useAdminCampaigns } from "@/services/admin/campaigns";
import { useActivateOffer, useAdminOffer, useAdminProduct, useArchiveOffer, usePauseOffer } from "@/services/admin/catalog";
import { OfferForm } from "@/components/admin/OfferForm";
import { DeliveryRegionsManager } from "@/components/admin/DeliveryRegionsManager";
import { offerStatusMeta, offerAvailabilityMeta, campaignStatusMeta } from "@/lib/status";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

// Mirrors OffersService's ALLOWED_TRANSITIONS on the backend exactly — the UI only ever offers
// actions the server will actually accept, but the server re-checks every one of these
// regardless (see offers.service.ts / RBAC.md); this is a UX convenience, not the enforcement.
const ALLOWED_NEXT_ACTIONS: Record<string, Array<"activate" | "pause" | "archive">> = {
  DRAFT: ["activate", "archive"],
  ACTIVE: ["pause", "archive"],
  PAUSED: ["activate", "archive"],
  ARCHIVED: [],
};

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const offerQuery = useAdminOffer(id);
  const activateOffer = useActivateOffer();
  const pauseOffer = usePauseOffer();
  const archiveOffer = useArchiveOffer();
  const [confirmArchive, setConfirmArchive] = useState(false);
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
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words font-heading text-2xl font-bold text-text-primary">{offer.name}</h1>
          <span className="shrink-0"><StatusBadge tone={offerStatusMeta[offer.status].tone} label={offerStatusMeta[offer.status].label} /></span>
          {offer.availability ? (
            <span className="shrink-0"><StatusBadge tone={offerAvailabilityMeta[offer.availability].tone} label={offerAvailabilityMeta[offer.availability].label} /></span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {ALLOWED_NEXT_ACTIONS[offer.status]?.includes("activate") ? (
            <Button
              variant="outline"
              size="sm"
              disabled={activateOffer.isPending}
              onClick={() => activateOffer.mutate(offer.id)}
            >
              <Play className="mr-1.5 size-4" /> Faollashtirish
            </Button>
          ) : null}
          {ALLOWED_NEXT_ACTIONS[offer.status]?.includes("pause") ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pauseOffer.isPending}
              onClick={() => pauseOffer.mutate(offer.id)}
            >
              <Pause className="mr-1.5 size-4" /> To&apos;xtatish
            </Button>
          ) : null}
          {ALLOWED_NEXT_ACTIONS[offer.status]?.includes("archive") ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
              <Archive className="mr-1.5 size-4" /> Arxivlash
            </Button>
          ) : null}
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

      <ConfirmModal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveOffer.mutateAsync(offer.id);
          setConfirmArchive(false);
        }}
        title="Offerni arxivlash"
        description="Arxivlangan offer qayta faollashtirilmaydi. Davom etishga ishonchingiz komilmi?"
        confirmLabel="Arxivlash"
        destructive
        isPending={archiveOffer.isPending}
      />

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

      {USE_REAL_API && productQuery.data?.type === "PHYSICAL_PRODUCT" ? <DeliveryRegionsManager offerId={offer.id} /> : null}

      <div className="mx-auto max-w-2xl">
        <OfferForm existing={offer} />
      </div>
    </div>
  );
}
