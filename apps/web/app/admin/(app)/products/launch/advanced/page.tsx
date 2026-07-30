"use client";

import Link from "next/link";
import { ProductLaunchWizard } from "@/components/admin/ProductLaunchWizard";

export default function ProductLaunchAdvancedPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="font-body text-xs text-text-muted">
        <Link href="/admin/products/launch" className="text-accent underline">
          &larr; Tezkor rejimga qaytish
        </Link>
      </p>
      <ProductLaunchWizard />
    </div>
  );
}
