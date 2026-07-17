import { Suspense } from "react";
import { NewCampaignPageClient } from "@/components/admin/NewCampaignPageClient";

export default function NewCampaignPage() {
  return (
    <Suspense fallback={null}>
      <NewCampaignPageClient />
    </Suspense>
  );
}
