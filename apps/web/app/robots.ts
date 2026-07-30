import type { MetadataRoute } from "next";
import { BRAND } from "@sofsavdo/config/brand";

// Admin/creator/buyer dashboards are gated behind login and have zero SEO value — indexing them
// would only leak internal URL structure. Their public entry points (register/login) are left
// crawlable since discoverability there is the whole point (creator sign-up especially).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalog", "/o/", "/legal/", "/creator/register", "/creator/login", "/creator/forgot-password", "/buyer/register", "/buyer/login"],
        disallow: ["/admin/", "/creator/", "/buyer/"],
      },
    ],
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
