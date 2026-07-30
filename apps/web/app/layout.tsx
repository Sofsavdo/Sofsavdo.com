import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BRAND } from "@sofsavdo/config/brand";

// Phase 15: tokens.css has named "Inter"/"Manrope" as --font-body/--font-heading since Phase 1,
// but nothing ever actually loaded them as web fonts — the audit confirmed zero next/font usage,
// zero @font-face, zero font files anywhere in the repo, meaning every page has silently been
// rendering in the browser's default system sans-serif this whole time. `cyrillic` is included
// alongside `latin` for real (not just theoretical) Russian-market readiness, per DESIGN_SYSTEM.md.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

// Organization + WebSite JSON-LD — the standard structured-data signal search engines (and any
// crawler-fed AI system) use to resolve an ambiguous brand-name query to the real, official site
// rather than an unrelated same-name domain. sameAs is left empty rather than filled with guessed
// social-profile URLs — an official account we don't actually control would be a false claim.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND.name,
  url: BRAND.url,
  logo: `${BRAND.url}/icon`,
  description: BRAND.tagline,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND.name,
  url: BRAND.url,
};

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: `${BRAND.name} (${BRAND.domain}) — tanlangan mahsulotlar, ishonchli to'lov va tez yetkazib berish. Rasmiy sayt.`,
  keywords: [BRAND.name, "Sofsavdo", BRAND.domain, "sofsavdo online do'kon", "sofsavdo creator"],
  alternates: { canonical: BRAND.url },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: `${BRAND.name} (${BRAND.domain}) — rasmiy sayt.`,
    url: BRAND.url,
  },
  twitter: {
    card: "summary",
    title: BRAND.name,
    description: `${BRAND.name} (${BRAND.domain}) — rasmiy sayt.`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
