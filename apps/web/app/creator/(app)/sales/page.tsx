"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SalesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/creator/earnings");
  }, [router]);

  return null;
}
