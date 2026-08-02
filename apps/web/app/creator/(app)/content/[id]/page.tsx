"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContentDetailPage() {
  const router = useRouter();

  useEffect(() => {
    // Content upload flows removed - redirect to streams
    router.replace("/creator/streams");
  }, [router]);

  return null;
}
