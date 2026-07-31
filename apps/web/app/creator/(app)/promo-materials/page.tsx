"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Card, CardHeader, CardTitle, CopyButton, EmptyState, Skeleton } from "@sofsavdo/ui";
import { Share2 } from "lucide-react";
import { useMyCampaigns } from "@/services/campaigns";

export default function PromoMaterialsPage() {
  const query = useMyCampaigns();
  const [shared, setShared] = useState<string | null>(null);

  // promoCode (a per-creator discount code layered on top of the referral link) is a separate,
  // not-yet-built feature — gating this page on its presence meant this page was permanently
  // empty even for a creator with a real, working referral link. The referral link alone is
  // enough to attribute a sale; promoCode support can be added here later without another gate.
  const eligible = (query.data ?? []).filter((cc) => cc.referralLink);

  async function handleShare(url: string, name: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // user cancelled the native share sheet — fall through to clipboard fallback
      }
    }
    await navigator.clipboard.writeText(url);
    setShared(url);
    setTimeout(() => setShared(null), 2000);
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Promo materiallar</h1>
        <p className="font-body text-sm text-text-secondary">
          Referral havola va promo kodlar faqat kampaniya tasdiqlangandan so&apos;ng shu yerda paydo bo&apos;ladi.
        </p>
      </div>

      {eligible.length === 0 ? (
        <EmptyState
          title="Hali faol kampaniyangiz yo'q"
          description="Kampaniya tasdiqlanishi bilan referral havola va promo kod avtomatik yaratiladi."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {eligible.map((cc) => (
            <Card key={cc.id}>
              <CardHeader className="flex-col items-start gap-1">
                <div className="flex w-full items-center justify-between">
                  <CardTitle>{cc.campaign.name}</CardTitle>
                  <Badge tone="success">{cc.referralLink!.clicks} click</Badge>
                </div>
              </CardHeader>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="rounded-input border border-border bg-white p-2">
                    <QRCodeSVG value={cc.referralLink!.fullUrl} size={104} />
                  </div>
                  <span className="font-body text-xs text-text-muted">QR kod</span>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <p className="mb-1 font-body text-xs text-text-muted">To&apos;liq referral havola</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-input bg-bg px-2.5 py-1.5 font-body text-xs text-text-secondary">
                        {cc.referralLink!.fullUrl}
                      </code>
                      <CopyButton value={cc.referralLink!.fullUrl} label="" />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-body text-xs text-text-muted">Qisqa havola</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-input bg-bg px-2.5 py-1.5 font-body text-xs text-text-secondary">
                        {cc.referralLink!.shortUrl}
                      </code>
                      <CopyButton value={cc.referralLink!.shortUrl} label="" />
                    </div>
                  </div>
                  {cc.promoCode ? (
                    <div>
                      <p className="mb-1 font-body text-xs text-text-muted">Promo kod</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-input bg-bg px-2.5 py-1.5 font-body text-sm font-semibold text-accent">
                          {cc.promoCode.code}
                        </code>
                        <CopyButton value={cc.promoCode.code} label="" />
                      </div>
                      <p className="mt-1 font-body text-xs text-text-muted">{cc.promoCode.usageCount} marta ishlatilgan</p>
                    </div>
                  ) : null}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleShare(cc.referralLink!.fullUrl, cc.campaign.name)}
                      className="inline-flex items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 font-body text-sm text-white hover:bg-accent-hover"
                    >
                      <Share2 className="size-3.5" /> Ulashish
                    </button>
                    {shared === cc.referralLink!.fullUrl ? (
                      <span className="self-center font-body text-xs text-success">Havola nusxalandi</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-input border border-dashed border-border p-3">
                <p className="mb-1 font-body text-xs font-medium text-text-muted">Landing sahifa ko&apos;rinishi (namuna)</p>
                <div className="rounded-input bg-bg p-3">
                  <p className="font-heading text-sm font-semibold text-text-primary">{cc.campaign.offer.name}</p>
                  <p className="font-body text-xs text-text-secondary">{cc.campaign.ctaLabel}</p>
                </div>
                <Link
                  href={`/creator/campaigns/${cc.campaignId}`}
                  className="mt-2 inline-block font-body text-xs text-accent underline"
                >
                  Admin tayyorlagan rasm/video va reklama matnlarini ko&apos;rish →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
