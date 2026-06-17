import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Deep force the Edge Runtime instance to anchor directly onto the custom subdomain paths
export const proxy = NextAuth({
  ...authConfig,
  basePath: "/api/auth",
  trustHost: true,
}).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
