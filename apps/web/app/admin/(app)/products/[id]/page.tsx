"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Archive } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { useAdminOffers, useAdminProduct, useArchiveProduct } from "@/services/admin/catalog";
import { ProductForm } from "@/components/admin/ProductForm";
import { productStatusMeta, offerStatusMeta } from "@/lib/status";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const productQuery = useAdminProduct(id);
  const offersQuery = useAdminOffers();
  const archiveProduct = useArchiveProduct();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (productQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const product = productQuery.data;
  if (!product) return <Alert tone="error">Mahsulot topilmadi.</Alert>;

  const relatedOffers = (offersQuery.data ?? []).filter((o) => o.productId === product.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/products" className="hover:text-text-primary">
          Products
        </Link>
        <span>/</span>
        <span className="text-text-primary">{product.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words font-heading text-2xl font-bold text-text-primary">{product.name}</h1>
          <span className="shrink-0"><StatusBadge tone={productStatusMeta[product.status].tone} label={productStatusMeta[product.status].label} /></span>
        </div>
        {product.status !== "ARCHIVED" ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
            <Archive className="mr-1.5 size-4" /> Arxivlash
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Narx va sotuv holati</CardTitle>
        </CardHeader>
        {relatedOffers.length === 0 ? (
          product.externalRedirectUrl ? (
            <Alert tone="info">
              Bu mahsulot Sofsavdo checkout&apos;idan o&apos;tmaydi — Flow havolasi to&apos;g&apos;ridan-to&apos;g&apos;ri sherik
              platformaga ({product.externalRedirectUrl}) yo&apos;naltiradi, shu sababli narx/Offer kerak emas.
              Creatorlarga allaqachon ko&apos;rinadi.
            </Alert>
          ) : (
            <div className="flex flex-col gap-2">
              <Alert tone="warning">
                Bu mahsulot uchun hali narx belgilanmagan — shu sababli u buyerlarga ham, creatorlarga ham
                ko&apos;rinmaydi.
              </Alert>
              <Link
                href={`/admin/products/launch?productId=${product.id}`}
                className="w-fit font-body text-sm text-accent underline"
              >
                Narx va komissiya kiritish (bir necha maydon, darhol jonli)
              </Link>
            </div>
          )
        ) : (
          <ul className="divide-y divide-border">
            {relatedOffers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-body text-sm text-text-primary">{o.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-numeric text-sm tabular-nums text-text-secondary">{formatMoneyMinor(o.priceMinor, o.currency)}</span>
                  <Badge tone={offerStatusMeta[o.status].tone}>{offerStatusMeta[o.status].label}</Badge>
                  <Link href={`/admin/landings/${o.id}/edit`} className="font-body text-sm text-accent underline">
                    Landing sahifa
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mx-auto max-w-2xl">
        <ProductForm existing={product} />
      </div>

      <ConfirmModal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveProduct.mutateAsync(product.id);
          setConfirmArchive(false);
        }}
        title="Mahsulotni arxivlash"
        description="Arxivlangan mahsulot yangi offer yaratish uchun ishlatilmaydi, lekin mavjud offerlar ishlashda davom etadi."
        confirmLabel="Arxivlash"
        destructive
        isPending={archiveProduct.isPending}
      />
    </div>
  );
}
