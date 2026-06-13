import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AppRole } from "@/lib/permissions";

export type AuthedUser = { id: string; role: AppRole; name: string; email: string };

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

  // "staff" is the legacy role — normalize to "sales" for backward compatibility
  const rawRole = (session.user as { role?: string }).role;
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
    id: (session.user as { id?: string }).id ?? "",
    role: role ?? ("sales" as AppRole),
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}
