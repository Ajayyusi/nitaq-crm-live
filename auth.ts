import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { authConfig } from "./auth.config";
import { rateLimit } from "@/lib/rate-limit";

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

class DBConnectionError extends CredentialsSignin {
  code = "db_error";
}

class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Pre-computed hash of a random string — used to equalize timing when the
// account doesn't exist, so attackers can't distinguish "no user" from
// "wrong password" by response time.
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,  // includes jwt, session, and authorized callbacks
  
  // 👇 CRITICAL: Force NextAuth runtime to lock onto your exact subdomain and ignore fallback headers
  trustHost: true,
  basePath: "/api/auth",
  
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new InvalidLogin("Email and password are required.");
        }
        const email = String(credentials.email).toLowerCase().trim();

        // Brute-force throttle: 10 attempts per email per 15 minutes
        const { ok } = rateLimit(`login:${email}`, 10, 15 * 60 * 1000);
        if (!ok) {
          throw new TooManyAttempts("Too many login attempts. Try again later.");
        }

        try {
          await connectDB();
        } catch {
          throw new DBConnectionError("Cannot reach database. Check Atlas IP whitelist.");
        }
        try {
          const user = await User.findOne({ email, active: true }).select("+password").lean();
          // Always run a bcrypt compare (dummy when no user) and return the
          // same generic error, so responses don't reveal whether the
          // account exists.
          const valid = await bcrypt.compare(
            String(credentials.password),
            user?.password ?? DUMMY_HASH
          );
          if (!user || !valid) throw new InvalidLogin("Invalid email or password.");
          await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
          return {
            id:    user._id.toString(),
            name:  user.name,
            email: user.email,
            role:  user.role,
          };
        } catch (err) {
          if (err instanceof CredentialsSignin) throw err;
          throw new InvalidLogin("Authentication failed.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
});
