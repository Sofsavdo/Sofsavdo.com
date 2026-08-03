"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyCampaignsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect my-campaigns to my-streams - merged flow
    router.replace("/creator/my-streams");
  }, [router]);

  return null;
}
