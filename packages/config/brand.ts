// Centralized brand identity — created Phase 15, updated for the Sofsavdo rebrand (Phase B).
// Every UI string that names the product or its support contact should import from here rather
// than a literal, so the next rename only ever touches this one file on the frontend side (the
// API side has its own parallel literals — see registry.ts/main.ts/settings.catalog.ts, none of
// which import from packages/config today).
export const BRAND = {
  name: "Sofsavdo",
  supportEmail: "support@sofsavdo.com",
  domain: "sofsavdo.com",
  url: "https://sofsavdo.com",
  tagline: "Ishonchli creator-affiliate savdo platformasi",
} as const;
