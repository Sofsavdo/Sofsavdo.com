/**
 * Oqimlar (Streams) Page
 *
 * Shows all products and services available for creators to promote.
 * Creator can select a product/service to create their stream.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoneyMinor } from '@sofsavdo/types';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton } from '@sofsavdo/ui';
import { CheckCircle2 } from 'lucide-react';
import { useAvailableProductsForPromotion } from '@/services/campaigns';
import { useFlows, useCreateFlow } from '@/services/flows';
import { useSession } from '@/services/session';
import { canWorkAsCreator } from '@/lib/routing';
import { ApiError } from '@/lib/api';

// What THIS creator would actually earn from one sale — shown before they commit to a flow, so
// they can pick a product by earning potential rather than price alone.
function computeEarningsMinor(product: { commissionType?: string | null; commissionRateBps?: number | null; commissionAmountMinor?: number | null; offers?: { priceMinor: number }[] }): number {
  const priceMinor = product.offers?.[0]?.priceMinor ?? 0;
  if (product.commissionType === 'FIXED_AMOUNT') return product.commissionAmountMinor ?? 0;
  if (product.commissionType === 'PERCENTAGE' && product.commissionRateBps) {
    return Math.round((priceMinor * product.commissionRateBps) / 10_000);
  }
  return 0;
}

export default function StreamsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const isApproved = user ? canWorkAsCreator(user.application.status) : false;

  const productsQuery = useAvailableProductsForPromotion({ enabled: isApproved });
  const flowsQuery = useFlows();
  const createFlow = useCreateFlow();
  const flowByProductId = new Map((flowsQuery.data ?? []).map((flow) => [flow.productId, flow]));
  const [creatingError, setCreatingError] = useState<{ productId: string; message: string } | null>(null);
  const [submittingProductId, setSubmittingProductId] = useState<string | null>(null);

  async function onTakeFlow(productId: string) {
    setCreatingError(null);
    setSubmittingProductId(productId);
    try {
      await createFlow.mutateAsync(productId);
    } catch (err) {
      setCreatingError({ productId, message: (err as ApiError).message ?? "Oqim yaratishda xatolik yuz berdi." });
    } finally {
      setSubmittingProductId(null);
    }
  }

  if (sessionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Show activation message if not approved
  if (!isApproved) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">Oqimlar</h1>
          <p className="font-body text-sm text-text-secondary">Barcha mahsulotlar va xizmatlarni ko&apos;ring va oqim yarating</p>
        </div>
        
        <Card>
          <Alert tone="warning">
            <p className="font-semibold mb-2">Hisobingiz hali aktivlashtirilmagan</p>
            <p className="font-body text-sm">
              Oqim yaratish uchun arizangiz tasdiqlanishi kerak. Arizangiz hozirda ko&apos;rib chiqilmoqda.
              Tasdiqlanishidan so&apos;ng oqim yaratish imkoniyati bo&apos;ladi.
            </p>
            <p className="font-body text-sm mt-2 text-text-muted">
              Arizangiz 6 soat ichida ko&apos;rib chiqiladi.
            </p>
          </Alert>
        </Card>
      </div>
    );
  }
  
  if (productsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }
  
  const products = productsQuery.data ?? [];
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mahsulotlar</h1>
        <p className="font-body text-sm text-text-secondary">Mahsulotni tanlang va bir bosishda o&apos;z oqimingizni oling</p>
      </div>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            title="Mahsulotlar yo'q"
            description="Hozircha targ'ib qilish uchun mahsulot yo'q."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => {
            const flow = flowByProductId.get(product.id);
            return (
              <Card key={product.id} className="hover:border-accent transition-colors">
                <div className="p-4 space-y-4">
                  <div className="aspect-[3/4] bg-bg rounded-lg overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        Rasm yo&apos;q
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-heading text-sm font-medium text-text-primary line-clamp-2">{product.name}</h3>
                    {product.shortDescription ? (
                      <p className="font-body text-xs text-text-muted mt-1 line-clamp-2">{product.shortDescription}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between">
                    {product.externalRedirectUrl ? (
                      <Badge tone="accent">
                        {product.commissionType === "PERCENTAGE" && product.commissionRateBps
                          ? `Komissiya: ${product.commissionRateBps / 100}% gacha`
                          : "Sherik dastur"}
                      </Badge>
                    ) : (
                      <span className="font-numeric text-lg font-bold tabular-nums text-accent">
                        {formatMoneyMinor(product.offers?.[0]?.priceMinor ?? 0)}
                      </span>
                    )}
                    {product.type === "PHYSICAL_PRODUCT" ? (
                      <Badge tone="success">
                        <CheckCircle2 className="mr-1 size-3" />
                        Original
                      </Badge>
                    ) : null}
                  </div>

                  <div className="rounded-input border border-success/30 bg-success/5 px-3 py-2">
                    <p className="font-body text-xs text-text-secondary">Siz ishlab olasiz</p>
                    {product.externalRedirectUrl ? (
                      <p className="font-numeric text-base font-bold tabular-nums text-success">
                        {product.estimatedEarningLabel ?? "Har bir pullik faollashtirishdan bonus (sherik hisoblaydi)"}
                      </p>
                    ) : (
                      <p className="font-numeric text-base font-bold tabular-nums text-success">
                        {formatMoneyMinor(computeEarningsMinor(product))}
                      </p>
                    )}
                  </div>

                  {flow ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Link href={`/creator/my-streams/${flow.id}`}>
                        Batafsil
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onTakeFlow(product.id)}
                        disabled={submittingProductId === product.id}
                      >
                        {submittingProductId === product.id ? "Yaratilmoqda..." : "Oqim olish"}
                      </Button>
                      {creatingError && creatingError.productId === product.id ? (
                        <Alert tone="error">{creatingError.message}</Alert>
                      ) : null}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
