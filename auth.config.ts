import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

const BASE_PUBLIC_PATHS = ["/login", "/api/auth"];

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true, // 👈 FORCES NEXTAUTH TO TRUST THE SUBDOMAIN HOST HEADER
  callbacks: {
    // These two callbacks run in BOTH the full auth.ts context (on login)
    // AND the proxy.ts edge context (on every request).
    // They must stay here so proxy.ts can read role/id from the JWT cookie.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string }).role = token.role as string;
      }
      return session;
    },

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

      // Skip role checks for API routes and the access-denied page itself
      if (pathname.startsWith("/api/") || pathname.startsWith("/access-denied")) {
        return true;
      }

      // "staff" is the legacy role — treat it as "sales" so existing users
      // are not locked out before the database migration runs.
      const rawRole = (auth?.user as { role?: string })?.role;
      const role = (rawRole === "staff" ? "sales" : rawRole) as AppRole | undefined;
      const rule = PAGE_PERMISSIONS.find((p) => pathname.startsWith(p.path));

      if (rule && (!role || !(rule.roles as string[]).includes(role))) {
        return NextResponse.redirect(new URL("/access-denied", nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
