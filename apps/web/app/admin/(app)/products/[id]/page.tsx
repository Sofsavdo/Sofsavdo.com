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
          <CardTitle>Shu productga qurilgan Offerlar</CardTitle>
        </CardHeader>
        {relatedOffers.length === 0 ? (
          <p className="font-body text-sm text-text-muted">
            Hali offer yaratilmagan.{" "}
            <Link href={`/admin/offers/new?productId=${product.id}`} className="text-accent underline">
              Offer yaratish
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {relatedOffers.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <Link href={`/admin/offers/${o.id}`} className="font-body text-sm text-text-primary hover:text-accent">
                  {o.name}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="font-numeric text-sm tabular-nums text-text-secondary">{formatMoneyMinor(o.priceMinor, o.currency)}</span>
                  <Badge tone={offerStatusMeta[o.status].tone}>{offerStatusMeta[o.status].label}</Badge>
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
