import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import ImpersonationToken from "@/models/ImpersonationToken";
import { logAudit } from "@/lib/audit";

/**
 * Ends an impersonated session and hands the admin back their own account.
 *
 * Deliberately NOT admin-gated: the caller is currently signed in as the
 * impersonated (lower-privileged) user. The only thing it will ever do is
 * return the session to the exact user recorded as the impersonator on the
 * current token, so it cannot be used to escalate into any other account.
 */
export async function POST() {
  const session = await auth();
  const u = session?.user as
    | { impersonatorId?: string; impersonatedBy?: string; name?: string; role?: string }
    | undefined;

  if (!u) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
  if (!u.impersonatorId) {
    return NextResponse.json({ message: "This is not an impersonated session." }, { status: 400 });
  }

  try {
    await connectDB();
    const admin = await User.findById(u.impersonatorId).lean();
    if (!admin || !admin.active) {
      return NextResponse.json(
        { message: "Your own account is no longer available. Please sign in again." },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString("hex");
    await ImpersonationToken.create({
      token,
      targetUserId: admin._id,
      targetEmail: admin.email,
      targetName: admin.name,
      createdById: admin._id,
      createdByEmail: admin.email,
      createdByName: admin.name,
      isReturn: true,
      expiresAt: new Date(Date.now() + 60_000),
    });

    logAudit({
      userName: admin.name,
      userRole: admin.role,
      action: "updated",
      entity: "Impersonation",
      entityId: String(u.impersonatorId),
      entityLabel: admin.name,
      detail: `Ended the session opened as ${u.name ?? "another user"}`,
    });

    return NextResponse.json({ url: `/impersonate?token=${token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end session.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
