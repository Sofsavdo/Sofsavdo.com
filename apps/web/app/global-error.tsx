"use client";

import { useEffect } from "react";
import "./globals.css";

// Only fires if the ROOT layout itself throws (vs. app/error.tsx, which handles every other
// segment) — Next.js requires this to render its own <html>/<body> since it fully replaces the
// root layout in that case. Re-imports globals.css per Next.js's own documented pattern for this
// exact file, since the layout that would normally load it never rendered.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="uz">
      <body className="font-body antialiased">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
          <h1 className="font-heading text-xl font-bold text-text-primary">Ilova ishga tushmadi</h1>
          <p className="mt-2 font-body text-sm text-text-secondary">Kutilmagan jiddiy xatolik yuz berdi. Iltimos, sahifani qayta yuklang.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-button bg-accent px-5 py-2 font-body text-sm font-medium text-white hover:bg-accent-hover"
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
