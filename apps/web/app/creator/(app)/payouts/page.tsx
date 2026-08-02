"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PayoutsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/creator/earnings");
  }, [router]);

  return null;
}
