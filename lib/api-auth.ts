import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import type { AppRole } from "@/lib/permissions";

export type AuthedUser = { id: string; role: AppRole; name: string; email: string };

// JWT sessions can't be revoked server-side, so re-check the user's `active`
// flag and role against the DB with a short-lived cache. Deactivating a user
// or changing their role takes effect within CACHE_TTL_MS instead of waiting
// out the 8-hour token.
const CACHE_TTL_MS = 60_000;
const userStateCache = new Map<string, { active: boolean; role?: string; exp: number }>();

async function getLiveUserState(userId: string): Promise<{ active: boolean; role?: string }> {
  const cached = userStateCache.get(userId);
  if (cached && cached.exp > Date.now()) return cached;
  try {
    await connectDB();
    const dbUser = await User.findById(userId).select("active role").lean();
    const state = { active: !!dbUser?.active, role: dbUser?.role, exp: Date.now() + CACHE_TTL_MS };
    if (userStateCache.size > 5000) userStateCache.clear();
    userStateCache.set(userId, state);
    return state;
  } catch {
    // DB hiccup — fail open to the token's claims rather than lock everyone out
    return { active: true, role: undefined };
  }
}

/**
 * Validates the session for an API route.
 *
 * Usage:
 *   const user = await requireAuth(["admin", "manager"]);
 *   if (user instanceof NextResponse) return user;   // 401 or 403
 *
 * Returns the session user on success, or a NextResponse error on failure.
 */
export async function requireAuth(
  allowedRoles?: AppRole[]
): Promise<AuthedUser | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id ?? "";

  // Live check: deactivated users lose API access immediately (within cache TTL),
  // and role changes take effect without waiting for the JWT to expire.
  let liveRole: string | undefined;
  if (userId) {
    const state = await getLiveUserState(userId);
    if (!state.active) {
      return NextResponse.json({ error: "Account is deactivated." }, { status: 401 });
    }
    liveRole = state.role;
  }

  // "staff" is the legacy role — normalize to "sales" for backward compatibility
  const rawRole = liveRole ?? (session.user as { role?: string }).role;
  const role = (rawRole === "staff" ? "sales" : rawRole) as AppRole | undefined;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !(allowedRoles as string[]).includes(role)) {
      return NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      );
    }
  }

  return {
    id: userId,
    role: role ?? ("sales" as AppRole),
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}
