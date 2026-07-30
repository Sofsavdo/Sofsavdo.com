/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization for SEO
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },

  // Cache control headers
  async headers() {
    return [
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Content-Type",
            value: "application/xml",
          },
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          {
            key: "Content-Type",
            value: "text/plain",
          },
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Redirects for domain consolidation
  async redirects() {
    return [
      {
        source: "/old-path/:path*",
        destination: "/:path*",
        permanent: true, // 301 redirect for SEO
      },
    ];
  },

  // Rewrite API calls
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL || "https://api.sofsavdo.com"}/:path*`,
        },
      ],
    };
  },

  // Compress output
  compress: true,

  // Generate ETags
  generateEtags: true,

  // Power by header (security)
  poweredByHeader: false,
};

export default nextConfig;

