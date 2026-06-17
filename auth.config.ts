export const authConfig = {
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    // 👇 INSULATE REDIRECTS: Force all internal callback URLs to stay on the subdomain
    async redirect({ url, baseUrl }) {
      if (url.includes("nitaqacademy.com") && !url.includes("app.nitaqacademy.com")) {
        return "https://nitaqacademy.com";
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
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
      // ... your existing authorized check code remains exactly the same
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const publicPaths = process.env.ENABLE_SETUP === "true" ? ["/login", "/api/auth", "/setup"] : ["/login", "/api/auth"];
      if (publicPaths.some((p) => pathname.startsWith(p))) return true;
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
