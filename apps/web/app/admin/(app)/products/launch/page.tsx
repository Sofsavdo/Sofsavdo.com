"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@sofsavdo/ui";
import { QuickProductLaunchForm } from "@/components/admin/QuickProductLaunchForm";
import { useAdminProduct } from "@/services/admin/catalog";

function ProductLaunchContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") ?? undefined;
  const productQuery = useAdminProduct(productId ?? "");

  if (productId && productQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <QuickProductLaunchForm existingProduct={productId ? (productQuery.data ?? undefined) : undefined} />
      <p className="text-center font-body text-xs text-text-muted">
        Har bir maydonni alohida sozlash kerakmi?{" "}
        <Link href="/admin/products/launch/advanced" className="text-accent underline">
          Bosqichma-bosqich (kengaytirilgan) rejim
        </Link>
      </p>
    </div>
  );
}

export default function ProductLaunchPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-96 w-full" />
      </div>
    }>
      <ProductLaunchContent />
    </Suspense>
  );
}
