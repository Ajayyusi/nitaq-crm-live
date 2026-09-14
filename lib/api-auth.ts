import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";

export type AuthedUser = { id: string; role: AppRole; name: string; email: string };

// JWT sessions can't be revoked server-side, so re-check the user's `active`
// flag and role against the DB with a short-lived cache. Deactivating a user
// or changing their role takes effect within CACHE_TTL_MS instead of waiting
// out the 8-hour token.
const CACHE_TTL_MS = 60_000;
// If the DB is briefly unreachable, a state we verified this recently is still
// trusted. Beyond that the request is refused: the token alone cannot tell us
// whether the account was deactivated or demoted.
const STALE_GRACE_MS = 15 * 60_000;

type LiveState = { active: boolean; role?: string; checkedAt: number };
const userStateCache = new Map<string, LiveState>();

/** Test hook — the cache is module state and must not leak between tests. */
export function __resetAuthCache() {
  userStateCache.clear();
}

async function getLiveUserState(userId: string): Promise<LiveState | null> {
  const cached = userStateCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached;
  try {
    await connectDB();
    const dbUser = await User.findById(userId).select("active role").lean();
    const state: LiveState = { active: !!dbUser?.active, role: dbUser?.role, checkedAt: Date.now() };
    if (userStateCache.size > 5000) userStateCache.clear();
    userStateCache.set(userId, state);
    return state;
  } catch (err) {
    // Fail closed. Previously this returned { active: true } and fell back to
    // the token's role, so a deactivated or demoted user kept full access for
    // as long as the DB lookup kept failing.
    if (cached && Date.now() - cached.checkedAt < STALE_GRACE_MS) return cached;
    console.error("[auth] live user check failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

const KNOWN_ROLES = new Set<string>(ALL_ROLES);

/**
 * Validates the session for an API route.
 *
 * Usage:
 *   const user = await requireAuth(["admin", "manager"]);
 *   if (user instanceof NextResponse) return user;   // 401, 403 or 503
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
  // Every session this app issues carries the user id — one without it cannot
  // be checked against the DB, so it is not trusted.
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Live check: deactivated or deleted users lose API access (within cache TTL),
  // and role changes take effect without waiting for the JWT to expire.
  const state = await getLiveUserState(userId);
  if (!state) {
    return NextResponse.json(
      { error: "Unable to verify your account right now. Please try again shortly." },
      { status: 503 }
    );
  }
  if (!state.active) {
    return NextResponse.json({ error: "Account is deactivated." }, { status: 401 });
  }

  // The DB role is authoritative. "staff" is the legacy role — normalize to "sales".
  const rawRole = state.role;
  const normalized = rawRole === "staff" ? "sales" : rawRole;
  if (!normalized || !KNOWN_ROLES.has(normalized)) {
    // No silent default: an account with a missing or unknown role gets nothing.
    return NextResponse.json(
      { error: "You do not have permission to perform this action." },
      { status: 403 }
    );
  }
  const role = normalized as AppRole;

  if (allowedRoles && allowedRoles.length > 0 && !(allowedRoles as string[]).includes(role)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action." },
      { status: 403 }
    );
  }

  // An impersonated session is only as valid as the admin driving it: once
  // that admin is deactivated or demoted, sessions they opened as other users
  // end too (they used to live on for the full 8 hours).
  const impersonatorId = (session.user as { impersonatorId?: string }).impersonatorId;
  if (impersonatorId) {
    const operator = await getLiveUserState(impersonatorId);
    if (!operator) {
      return NextResponse.json(
        { error: "Unable to verify your account right now. Please try again shortly." },
        { status: 503 }
      );
    }
    if (!operator.active || operator.role !== "admin") {
      return NextResponse.json({ error: "This impersonation session has ended." }, { status: 401 });
    }
  }

  // When an admin is impersonating, actions are attributed to the account
  // being used AND the real operator, so the audit trail is never misleading.
  const impersonatedBy = (session.user as { impersonatedBy?: string }).impersonatedBy;
  const baseName = session.user.name ?? "";

  return {
    id: userId,
    role,
    name: impersonatedBy ? `${baseName} (via ${impersonatedBy})` : baseName,
    email: session.user.email ?? "",
  };
}
