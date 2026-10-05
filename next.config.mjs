/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Admin area: never cached, never indexed, never framed.
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" }
    ];
    return [
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/api/admin/:path*", headers: privateHeaders }
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Optimised images are kept for 30 days on the CDN: repeat visits never re-fetch/re-encode.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Remote sources are allowed so imported Shopify/Woo images can be optimized.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "**.myshopify.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.wp.com" },
      { protocol: "https", hostname: "**" }
    ]
  }
};
export default nextConfig;
