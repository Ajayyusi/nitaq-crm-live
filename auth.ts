import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { authConfig } from "./auth.config";

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

class DBConnectionError extends CredentialsSignin {
  code = "db_error";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new InvalidLogin("Email and password are required.");
        }
        try {
          await connectDB();
        } catch {
          throw new DBConnectionError("Cannot reach database. Check Atlas IP whitelist.");
        }
        try {
          const user = await User.findOne({
            email: String(credentials.email).toLowerCase().trim(),
            active: true,
          }).lean();
          if (!user) throw new InvalidLogin("No account found.");
          const valid = await bcrypt.compare(String(credentials.password), user.password);
          if (!valid) throw new InvalidLogin("Wrong password.");
          await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (err) {
          if (err instanceof CredentialsSignin) throw err;
          throw new InvalidLogin("Authentication failed.");
        }
      },
    }),
  ],
  callbacks: {
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
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
});
