import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

const BASE_PUBLIC_PATHS = ["/login", "/api/auth"];

export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    // 👇 FIXED REDIRECTS: Force all absolute variations to stay locked on the subdomain
    async redirect({ url, baseUrl }) {
      // Allow relative redirects
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin redirects
      try {
        const target = new URL(url);
        const base = new URL(baseUrl);
        if (target.origin === base.origin) return url;
      } catch { /* ignore */ }
      // Everything else → login
      return `${baseUrl}/login`;
    },
    
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
      if (BASE_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;
      if (!isLoggedIn) return false;
      if (pathname.startsWith("/api/") || pathname.startsWith("/access-denied")) return true;
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
