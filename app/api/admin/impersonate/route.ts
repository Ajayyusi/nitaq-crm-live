import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import ImpersonationToken from "@/models/ImpersonationToken";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

/**
 * Mint a single-use, 60-second ticket that opens a session as another user.
 *
 * Admin only. Never returns credentials — only a one-shot ticket that the
 * /impersonate page exchanges for a session. Admin accounts can never be
 * impersonated, and every request is written to the audit log.
 *
 * Body: { userId } or { teacherId } (resolved to the teacher's login by email)
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    let target = null;
    if (body.userId && mongoose.Types.ObjectId.isValid(String(body.userId))) {
      target = await User.findById(String(body.userId)).lean();
    } else if (body.teacherId && mongoose.Types.ObjectId.isValid(String(body.teacherId))) {
      const teacher = await Teacher.findById(String(body.teacherId)).select("fullName email").lean();
      if (!teacher) return NextResponse.json({ message: "Trainer not found." }, { status: 404 });
      if (!teacher.email) {
        return NextResponse.json(
          { message: `${teacher.fullName} has no email on their trainer profile, so there is no login account to open. Add their email first.` },
          { status: 400 }
        );
      }
      target = await User.findOne({ email: teacher.email.toLowerCase() }).lean();
      if (!target) {
        return NextResponse.json(
          { message: `No user account exists for ${teacher.email}. Create a login for this trainer under Settings → Users first.` },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json({ message: "A user or trainer is required." }, { status: 400 });
    }

    if (!target) return NextResponse.json({ message: "User not found." }, { status: 404 });
    if (!target.active) return NextResponse.json({ message: "That account is deactivated." }, { status: 400 });
    if (target.role === "admin") {
      return NextResponse.json({ message: "Administrator accounts cannot be impersonated." }, { status: 403 });
    }
    if (target._id.toString() === authed.id) {
      return NextResponse.json({ message: "That is already your own account." }, { status: 400 });
    }

    const token = randomBytes(32).toString("hex");
    await ImpersonationToken.create({
      token,
      targetUserId: target._id,
      targetEmail: target.email,
      targetName: target.name,
      createdById: authed.id,
      createdByEmail: authed.email,
      createdByName: authed.name,
      expiresAt: new Date(Date.now() + 60_000), // 60 seconds to redeem
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "Impersonation",
      entityId: target._id.toString(), entityLabel: target.name,
      detail: `Opened a session as ${target.name} (${target.role})`,
    });

    return NextResponse.json({
      url: `/impersonate?token=${token}`,
      targetName: target.name,
      targetRole: target.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start session.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
