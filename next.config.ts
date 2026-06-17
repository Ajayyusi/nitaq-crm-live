import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
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
};

export default nextConfig;