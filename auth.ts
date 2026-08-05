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

// Password OK but a TOTP code is required (or was wrong) — the login form
// reacts to this code by showing the authenticator-code step.
class OtpRequired extends CredentialsSignin {
  code = "otp_required";
}

class OtpInvalid extends CredentialsSignin {
  code = "otp_invalid";
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
        otp:      { label: "Authenticator code", type: "text" },
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
          const user = await User.findOne({ email, active: true })
            .select("+password +twoFactorSecret")
            .lean();
          // Always run a bcrypt compare (dummy when no user) and return the
          // same generic error, so responses don't reveal whether the
          // account exists.
          const valid = await bcrypt.compare(
            String(credentials.password),
            user?.password ?? DUMMY_HASH
          );
          if (!user || !valid) throw new InvalidLogin("Invalid email or password.");

          // Second factor: users with 2FA on must supply a valid TOTP code
          if (user.twoFactorEnabled && user.twoFactorSecret) {
            const otp = String(credentials.otp ?? "").trim();
            if (!otp) throw new OtpRequired("Authenticator code required.");
            const { verifyTotp } = await import("@/lib/totp");
            if (!verifyTotp(user.twoFactorSecret, otp)) {
              throw new OtpInvalid("Invalid authenticator code.");
            }
          }

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

    /**
     * Admin impersonation ("open as user"). Never accepts a password — only a
     * single-use ticket minted by /api/admin/impersonate, which itself
     * requires an admin session. The ticket is consumed here, and the
     * resulting session records who is really driving it so every action
     * stays attributable.
     */
    Credentials({
      id: "impersonate",
      name: "Impersonate",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const raw = String(credentials?.token ?? "").trim();
        if (!raw) throw new InvalidLogin("Missing impersonation token.");
        try {
          await connectDB();
        } catch {
          throw new DBConnectionError("Cannot reach database.");
        }

        const { default: ImpersonationToken } = await import("@/models/ImpersonationToken");
        // Atomically consume: a token can only ever be redeemed once
        const ticket = await ImpersonationToken.findOneAndUpdate(
          { token: raw, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
          { $set: { usedAt: new Date() } },
          { new: true }
        );
        if (!ticket) throw new InvalidLogin("This impersonation link is invalid, already used, or expired.");

        const target = await User.findById(ticket.targetUserId).lean();
        if (!target || !target.active) throw new InvalidLogin("That account is unavailable.");
        // Defence in depth: never allow impersonating an admin. The one
        // exception is a return ticket, which only ever hands an admin back
        // the account they were already signed in as.
        if (target.role === "admin" && !ticket.isReturn) {
          throw new InvalidLogin("Administrator accounts cannot be impersonated.");
        }

        // A return ticket restores a normal session — no impersonation marks.
        if (ticket.isReturn) {
          return {
            id:    target._id.toString(),
            name:  target.name,
            email: target.email,
            role:  target.role,
          };
        }

        return {
          id:    target._id.toString(),
          name:  target.name,
          email: target.email,
          role:  target.role,
          impersonatedBy: ticket.createdByName,
          impersonatorEmail: ticket.createdByEmail,
          impersonatorId: ticket.createdById.toString(),
        } as never;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
});
