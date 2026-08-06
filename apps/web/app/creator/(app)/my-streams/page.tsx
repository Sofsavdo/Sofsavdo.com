/**
 * Mening Oqimlarim (My Flows) Page
 *
 * Shows the creator's real Flow links (one per product they've taken) with real
 * click/order/commission stats.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoneyMinor } from '@sofsavdo/types';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton } from '@sofsavdo/ui';
import { useFlows, getReferralUrl } from '@/services/flows';
import { useSession } from '@/services/session';
import { canWorkAsCreator } from '@/lib/routing';

export default function MyStreamsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const isApproved = user ? canWorkAsCreator(user.application.status) : false;

  const flowsQuery = useFlows();
  const [copiedFlowId, setCopiedFlowId] = useState<string | null>(null);

  async function onCopy(flowId: string, referralCode: string) {
    try {
      await navigator.clipboard.writeText(getReferralUrl(referralCode));
      setCopiedFlowId(flowId);
      setTimeout(() => setCopiedFlowId((current) => (current === flowId ? null : current)), 2000);
    } catch {
      // Ignore — button label simply won't flip to "Nusxa olindi!" if the browser blocked it.
    }
  }

  if (sessionLoading || (isApproved && flowsQuery.isLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mening oqimlarim</h1>
        <Card>
          <Alert tone="warning">
            <p className="font-semibold mb-2">Hisobingiz hali aktivlashtirilmagan</p>
            <p className="font-body text-sm">
              Oqimlaringizni ko&apos;rish uchun arizangiz tasdiqlanishi kerak.
            </p>
          </Alert>
        </Card>
      </div>
    );
  }

  const flows = flowsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mening oqimlarim</h1>
        <p className="font-body text-sm text-text-secondary">Har bir oqim — bitta mahsulot, bitta shaxsiy havola</p>
      </div>

      {flows.length === 0 ? (
        <Card>
          <EmptyState
            title="Oqim yo'q"
            description="Hozircha sizda hech qanday oqim yo'q. Mahsulotlar bo'limidan birini tanlab oqim yarating."
            action={
              <Button asChild variant="outline">
                <Link href="/creator/streams">Mahsulotlarga o&apos;tish</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card key={flow.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-2">{flow.product.name}</CardTitle>
                  <Badge tone={flow.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {flow.status === 'ACTIVE' ? 'Faol' : "To'xtatilgan"}
                  </Badge>
                </div>
              </CardHeader>
              <div className="flex flex-1 flex-col gap-3 px-6 pb-6">
                {flow.product.images.length > 0 && (
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-border">
                    <img src={flow.product.images[0]} alt={flow.product.name} className="h-full w-full object-cover" />
                  </div>
                )}

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

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    readOnly
                    value={getReferralUrl(flow.referralCode)}
                    className="min-w-0 flex-1 rounded-input border border-border bg-bg px-3 py-2 font-body text-sm text-text-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onCopy(flow.id, flow.referralCode)}
                  >
                    {copiedFlowId === flow.id ? 'Nusxa olindi!' : 'Nusxa'}
                  </Button>
                </div>

                <Button asChild size="sm" className="w-full">
                  <Link href={`/creator/my-streams/${flow.id}`}>Batafsil</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
