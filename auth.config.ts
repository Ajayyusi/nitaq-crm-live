import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

const BASE_PUBLIC_PATHS = ["/login", "/api/auth"];

export const authConfig = {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const publicPaths = process.env.ENABLE_SETUP === "true"
        ? [...BASE_PUBLIC_PATHS, "/setup"]
        : BASE_PUBLIC_PATHS;
      const isPublic = publicPaths.some((p) => pathname.startsWith(p));
      if (isPublic) return true;

      // Must be logged in for all other routes
      if (!isLoggedIn) return false;

      // Skip role checks for non-page routes (API, static, etc.)
      if (pathname.startsWith("/api/") || pathname.startsWith("/access-denied")) {
        return true;
      }

      // Check role-based page access
      const role = (auth?.user as { role?: string })?.role as AppRole | undefined;
      const rule = PAGE_PERMISSIONS.find((p) => pathname.startsWith(p.path));

      if (rule && (!role || !(rule.roles as string[]).includes(role))) {
        return NextResponse.redirect(new URL("/access-denied", nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
