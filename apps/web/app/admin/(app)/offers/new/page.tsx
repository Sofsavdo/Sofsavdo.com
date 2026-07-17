import { Suspense } from "react";
import { NewOfferPageClient } from "@/components/admin/NewOfferPageClient";

export default function NewOfferPage() {
  return (
    <Suspense fallback={null}>
      <NewOfferPageClient />
    </Suspense>
  );
}
