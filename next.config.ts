import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  // Prevent any accidental redirect from the subdomain to the root domain.
  // All auth redirects use relative paths (/login, /dashboard) so no
  // absolute URLs are needed here. This block is intentionally empty —
  // do NOT add hardcoded domain redirects.
  async redirects() {
    return [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;