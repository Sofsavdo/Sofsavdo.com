/**
 * Oqimlar (Streams) Page
 *
 * Shows all products and services available for creators to promote.
 * Creator can select a product/service to create their stream.
 */

'use client';

import Link from 'next/link';
import { formatMoneyMinor } from '@sofsavdo/types';
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton } from '@sofsavdo/ui';
import { useAvailableProductsForPromotion } from '@/services/campaigns';
import { useFlows, useCreateFlow } from '@/services/flows';
import { useSession } from '@/services/session';
import { canWorkAsCreator } from '@/lib/routing';

export default function StreamsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const isApproved = user ? canWorkAsCreator(user.application.status) : false;

  const productsQuery = useAvailableProductsForPromotion({ enabled: isApproved });
  const flowsQuery = useFlows();
  const createFlow = useCreateFlow();
  const flowByProductId = new Map((flowsQuery.data?.flows ?? []).map((flow) => [flow.productId, flow]));

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
                  <div className="aspect-square bg-bg rounded-lg overflow-hidden">
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
                    <p className="font-body text-xs text-text-muted mt-1">{product.category}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-numeric text-lg font-bold tabular-nums text-accent">
                      {formatMoneyMinor(product.offers?.[0]?.priceMinor ?? 0)}
                    </span>
                    <Badge tone="neutral">{product.type}</Badge>
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
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => createFlow.mutateAsync(product.id)}
                      disabled={createFlow.isPending}
                    >
                      {createFlow.isPending ? "Yaratilmoqda..." : "Oqim olish"}
                    </Button>
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
