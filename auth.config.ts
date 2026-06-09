import type { NextAuthConfig } from "next-auth";

const BASE_PUBLIC_PATHS = ["/login", "/api/auth", "/api/seed"];

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
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
