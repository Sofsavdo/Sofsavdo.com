import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BRAND } from "@rosti/config/brand";

// Phase 15: tokens.css has named "Inter"/"Manrope" as --font-body/--font-heading since Phase 1,
// but nothing ever actually loaded them as web fonts — the audit confirmed zero next/font usage,
// zero @font-face, zero font files anywhere in the repo, meaning every page has silently been
// rendering in the browser's default system sans-serif this whole time. `cyrillic` is included
// alongside `latin` for real (not just theoretical) Russian-market readiness, per DESIGN_SYSTEM.md.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name} — yopiq creator affiliate commerce platformasi`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
