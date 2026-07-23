import { Suspense } from "react";
import { CampaignApplicationsPageClient } from "@/components/admin/CampaignApplicationsPageClient";

// useSearchParams (the ?campaignId= filter deep-link from the campaign detail page) requires a
// Suspense boundary — same pattern as campaigns/new and offers/new.
export default function CampaignApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignApplicationsPageClient />
    </Suspense>
  );
}
