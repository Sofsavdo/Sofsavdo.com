"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CampaignsCatalogPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect campaigns to streams - merged flow
    router.replace("/creator/streams");
  }, [router]);

  return null;
}
