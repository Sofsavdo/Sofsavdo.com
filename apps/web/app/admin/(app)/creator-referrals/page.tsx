import { Suspense } from "react";
import { CreatorReferralsPageClient } from "@/components/admin/CreatorReferralsPageClient";

export default function CreatorReferralsPage() {
  return (
    <Suspense fallback={null}>
      <CreatorReferralsPageClient />
    </Suspense>
  );
}
