"use client";

import { useSearchParams } from "next/navigation";
import { CampaignForm } from "./CampaignForm";

export function NewCampaignPageClient() {
  const searchParams = useSearchParams();
  const offerId = searchParams.get("offerId") ?? undefined;
  return (
    <div className="mx-auto max-w-2xl">
      <CampaignForm defaultOfferId={offerId} />
    </div>
  );
}
