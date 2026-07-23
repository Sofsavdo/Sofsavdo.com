"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Skeleton } from "@rosti/ui";
import { useAdminSession } from "@/services/adminSession";
import { usePreviewLanding } from "@/services/admin/catalog";
import { LandingSectionRenderer } from "@/components/offer/sections";

// Deliberately outside the admin/(app) route group — that group's layout wraps every page in
// AdminShell (sidebar/topbar), which the Landing builder's iframe preview would otherwise render
// nested inside itself. This page does its own lightweight auth check instead, so an unpublished
// (DRAFT) landing renders exactly like the real public page would once published, chrome-free,
// while still requiring a real admin session (unlike the actual public route).
export default function LandingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = use(params);
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useAdminSession();
  // Gated on the session bootstrap finishing (not just `!!offerId`) — firing this immediately on
  // mount raced the session hook's own token-refresh call for the same single-use refresh
  // cookie, so whichever request lost the race got a permanent 401 (see PROJECT_STATUS.md).
  const query = usePreviewLanding(offerId, !sessionLoading && !!user);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace("/admin/login");
  }, [sessionLoading, user, router]);

  if (sessionLoading || !user || query.isLoading) {
    return (
      <div className="mx-auto max-w-page space-y-6 px-pad-mobile py-12 md:px-pad-desktop">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!query.data) return <Alert tone="error">Bu offer uchun landing sahifa hali yaratilmagan.</Alert>;

  const { offer, sections } = query.data;
  const activeVariantId = selectedVariantId ?? offer.variants.find((v) => v.isDefault)?.id ?? offer.variants[0]?.id ?? "";

  return (
    <div>
      {sections.map((section) => (
        <LandingSectionRenderer
          key={section.id}
          offer={offer}
          section={section}
          selectedVariantId={activeVariantId}
          onSelectVariant={setSelectedVariantId}
          onBuyClick={() => undefined}
        />
      ))}
    </div>
  );
}
