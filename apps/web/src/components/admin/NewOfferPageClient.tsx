"use client";

import { useSearchParams } from "next/navigation";
import { OfferForm } from "./OfferForm";

export function NewOfferPageClient() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") ?? undefined;
  return (
    <div className="mx-auto max-w-2xl">
      <OfferForm defaultProductId={productId} />
    </div>
  );
}
