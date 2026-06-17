import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Force NextAuth to trust the Vercel subdomain header at the Edge Middleware level
export const proxy = NextAuth({
  ...authConfig,
  trustHost: true,
}).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
