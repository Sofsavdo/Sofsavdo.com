/**
 * Mening Oqimim (Flow Detail) Page
 *
 * Shows one real Flow: its product, referral link, QR code, share buttons, and real stats.
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { formatMoneyMinor } from '@sofsavdo/types';
import { Badge, Button, Card, CardHeader, CardTitle, Skeleton } from '@sofsavdo/ui';
import { useFlows, getReferralUrl } from '@/services/flows';

export default function MyStreamDetailPage() {
  const params = useParams<{ id: string }>();
  const flowsQuery = useFlows();
  const [copied, setCopied] = useState(false);

  if (flowsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const flow = flowsQuery.data?.flows.find((f) => f.id === params.id);

  if (!flow) {
    return (
      <Card>
        <p className="p-6 text-center font-body text-sm text-text-muted">Oqim topilmadi</p>
      </Card>
    );
  }

  const referralUrl = getReferralUrl(flow.referralCode);
  const priceMinor = flow.product.offers[0]?.priceMinor ?? 0;
  const commissionLabel =
    flow.product.commissionType === 'PERCENTAGE'
      ? `${((flow.product.commissionRateBps ?? 0) / 100).toFixed(1)}%`
      : formatMoneyMinor(flow.product.commissionAmountMinor ?? 0);
  const estimatedEarningMinor =
    flow.product.commissionType === 'PERCENTAGE'
      ? Math.round((priceMinor * (flow.product.commissionRateBps ?? 0)) / 10000)
      : (flow.product.commissionAmountMinor ?? 0);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `Bu mahsulotni ko'ring: ${flow.product.name}\n\n${referralUrl}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mening oqimim</h1>
        <p className="font-body text-sm text-text-secondary">Havolani oling va tarqating</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-4">
            <div className="mb-4 aspect-square overflow-hidden rounded-lg bg-bg">
              {flow.product.images.length > 0 ? (
                <img src={flow.product.images[0]} alt={flow.product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">Rasm yo&apos;q</div>
              )}
            </div>
            <h2 className="mb-2 font-heading text-xl font-bold text-text-primary">{flow.product.name}</h2>
            <div className="mb-4 flex items-center gap-3">
              <span className="font-numeric text-2xl font-bold tabular-nums text-accent">
                {formatMoneyMinor(priceMinor)}
              </span>
              <Badge tone="success">{commissionLabel} komissiya</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-bg p-3">
              <div className="text-center">
                <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">{flow.clickCount}</p>
                <p className="font-body text-xs text-text-muted">Bosish</p>
              </div>
              <div className="text-center">
                <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">{flow.orderCount}</p>
                <p className="font-body text-xs text-text-muted">Buyurtma</p>
              </div>
              <div className="text-center">
                <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">
                  {formatMoneyMinor(flow.commissionEarnedMinor)}
                </p>
                <p className="font-body text-xs text-text-muted">Komissiya</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral havola</CardTitle>
            </CardHeader>
            <div className="space-y-4 px-6 pb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralUrl}
                  className="flex-1 rounded-input border border-border bg-bg px-3 py-2 font-body text-sm"
                />
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? 'Nusxa olindi!' : 'Nusxa olish'}
                </Button>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
                <p className="font-body text-sm text-text-muted">QR kod</p>
                <QRCodeSVG value={referralUrl} size={150} />
                <p className="font-body text-xs text-text-muted">Skanerlang va havolani oching</p>
              </div>

              <div className="rounded-lg bg-accent/10 p-4">
                <p className="font-body text-sm font-medium text-text-primary">Har bir sotuvdan taxminan:</p>
                <p className="font-numeric text-2xl font-bold tabular-nums text-accent">
                  {formatMoneyMinor(estimatedEarningMinor)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ijtimoiy tarmoqlarda ulashish</CardTitle>
            </CardHeader>
            <div className="flex gap-2 px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`, '_blank')
                }
              >
                Telegram
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}
              >
                WhatsApp
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
