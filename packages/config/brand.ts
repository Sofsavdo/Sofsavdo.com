// Centralized brand identity — Phase 15. Previously "Rosti" and "support@rosti.uz" were string
// literals in 8+ files (AdminShell, CreatorShell, AdminLoginPageClient, OfferLandingPageClient,
// auth layout, root layout metadata, ...) with no single source of truth, so a future rebrand
// (the platform may become "Sofsavdo" or another name) would mean hunting down every occurrence
// by hand. Every UI string that names the product or its support contact should import from here.
export const BRAND = {
  name: "Rosti",
  supportEmail: "support@rosti.uz",
} as const;
