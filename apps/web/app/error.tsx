"use client";

import { useEffect } from "react";
import Link from "next/link";

// Root-level error boundary — catches any rendering/data error thrown by a route segment that
// doesn't define its own error.tsx (Next.js wraps every segment in its nearest ancestor boundary).
// Deliberately generic and reused everywhere per Phase 14 §11 ("do not redesign the entire
// interface") rather than a bespoke page per section.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-pad-mobile text-center md:px-pad-desktop">
      <h1 className="font-heading text-xl font-bold text-text-primary">Nimadir xato ketdi</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko&apos;ring.</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-button bg-accent px-5 py-2 font-body text-sm font-medium text-white hover:bg-accent-hover"
        >
          Qayta urinish
        </button>
        <Link href="/" className="rounded-button border border-border px-5 py-2 font-body text-sm font-medium text-text-primary hover:bg-surface">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
