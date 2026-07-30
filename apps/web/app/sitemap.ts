import type { MetadataRoute } from "next";
import { BRAND } from "@sofsavdo/config/brand";
import { getCatalog } from "@/lib/api";

// Same defensive `.catch(() => [])` pattern as /catalog and / (page.tsx) — a backend hiccup at
// sitemap-generation time should yield a smaller sitemap, never a 500 that de-indexes the site.
// Capped at 20 pages (well beyond this catalog's current real scale) so one pathological run can't
// turn into an unbounded fetch loop.
async function getAllOfferSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  for (let page = 1; page <= 20; page++) {
    try {
      const result = await getCatalog({ page });
      slugs.push(...result.items.map((item) => item.slug));
      if (page >= result.totalPages) break;
    } catch {
      break;
    }
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const offerSlugs = await getAllOfferSlugs();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BRAND.url, changeFrequency: "daily", priority: 1 },
    { url: `${BRAND.url}/catalog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BRAND.url}/creator/register`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BRAND.url}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BRAND.url}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BRAND.url}/legal/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const offerRoutes: MetadataRoute.Sitemap = offerSlugs.map((slug) => ({
    url: `${BRAND.url}/o/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...offerRoutes];
}
