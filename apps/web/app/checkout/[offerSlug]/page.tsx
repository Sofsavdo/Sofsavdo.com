import { Suspense } from "react";
import { CheckoutPageClient } from "@/components/offer/CheckoutPageClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ offerSlug: string }> }) {
  const { offerSlug } = await params;
  return (
    <Suspense fallback={null}>
      <CheckoutPageClient offerSlug={offerSlug} />
    </Suspense>
  );
}
