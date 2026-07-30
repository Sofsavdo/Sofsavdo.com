import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BRAND } from "@sofsavdo/config/brand";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Sofsavdo - Online Marketplace | Buy & Sell | uz.sofsavdo.com",
  description: "Sofsavdo - Uzbekistan's leading online marketplace. Buy and sell products safely with fast delivery and secure payments. Trusted by thousands of sellers and buyers.",
  keywords: ["sofsavdo", "online shopping", "marketplace", "Uzbekistan", "buy online", "sell online", "e-commerce"],
  
  // Canonical URL
  metadataBase: new URL("https://sofsavdo.com"),
  
  // Open Graph for social sharing
  openGraph: {
    title: "Sofsavdo - Online Marketplace",
    description: "Uzbekistan's leading online marketplace for buying and selling products safely.",
    url: "https://sofsavdo.com",
    siteName: "Sofsavdo",
    locale: "uz_UZ",
    type: "website",
    images: [{
      url: "https://sofsavdo.com/og-image.png",
      width: 1200,
      height: 630,
      alt: "Sofsavdo Marketplace",
    }],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Sofsavdo - Online Marketplace",
    description: "Buy and sell products safely on Uzbekistan's leading marketplace.",
    images: ["https://sofsavdo.com/og-image.png"],
  },

  // Search engines
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  // Alternative language versions
  alternates: {
    languages: {
      "uz-UZ": "https://sofsavdo.com",
      "ru-RU": "https://ru.sofsavdo.com",
      "en-US": "https://en.sofsavdo.com",
    },
    canonical: "https://sofsavdo.com",
  },

  // Viewport
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },

  // Icons
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  // Verification
  verification: {
    google: "google-site-verification-code-here",
    yandex: "yandex-verification-code-here",
  },
};

// JSON-LD Schema.org markup for rich snippets
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Sofsavdo",
  url: "https://sofsavdo.com",
  logo: "https://sofsavdo.com/logo.png",
  description: "Uzbekistan's leading online marketplace",
  sameAs: [
    "https://www.facebook.com/sofsavdo",
    "https://www.instagram.com/sofsavdo",
    "https://www.twitter.com/sofsavdo",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    email: "support@sofsavdo.com",
    url: "https://sofsavdo.com/support",
  },
  areaServed: "UZ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        {/* Preload critical fonts */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/manrope.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="https://api.sofsavdo.com" />
        
        {/* Schema.org JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        
        {/* Google verification (add your actual code) */}
        <meta name="google-site-verification" content="YOUR_GOOGLE_VERIFICATION_CODE" />
        
        {/* Yandex verification (add your actual code) */}
        <meta name="yandex-verification" content="YOUR_YANDEX_VERIFICATION_CODE" />
        
        {/* Language and region hints */}
        <meta httpEquiv="content-language" content="uz-UZ" />
        <meta name="language" content="Uzbek" />
      </head>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

