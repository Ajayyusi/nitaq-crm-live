import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AttendanceSession, { attendanceStatuses } from "@/models/Attendance";
import { serializeSession } from "@/lib/serializers";
import { requireAuth, type AuthedUser } from "@/lib/api-auth";
import { getTeacherForUser } from "@/lib/teacher";

type RouteContext = { params: Promise<{ id: string }> };

const allowedStatuses = new Set<string>(attendanceStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/** Trainers may only touch sessions recorded under their own name. */
async function trainerOwnsSession(
  authed: AuthedUser,
  session: { trainerName?: string }
): Promise<boolean> {
  if (authed.role !== "trainer") return true;
  const teacher = await getTeacherForUser(authed);
  return !!teacher && (session.trainerName ?? "") === teacher.fullName;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const session = await AttendanceSession.findById(id).lean();
  if (!session) return NextResponse.json({ message: "Session not found." }, { status: 404 });
  if (!(await trainerOwnsSession(authed, session))) {
    return NextResponse.json({ message: "This session belongs to another teacher." }, { status: 403 });
  }
  return NextResponse.json({ session: serializeSession(session) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();

    // Trainers may only edit their own sessions, and cannot reassign them
    const existing = await AttendanceSession.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Session not found." }, { status: 404 });
    if (!(await trainerOwnsSession(authed, existing))) {
      return NextResponse.json({ message: "This session belongs to another teacher." }, { status: 403 });
    }

    const body = await request.json();
    if (authed.role === "trainer") delete body.trainerName;
    const update: Record<string, unknown> = {};

    for (const f of ["course", "batchName", "topic", "trainerName"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("sessionDate" in body) update.sessionDate = body.sessionDate ? new Date(body.sessionDate) : undefined;
    if ("sessionNumber" in body) update.sessionNumber = body.sessionNumber ? Number(body.sessionNumber) : undefined;

    if ("records" in body && Array.isArray(body.records)) {
      update.records = body.records.map((r: any) => {
        const status = clean(r.status) || "Present";
        if (!allowedStatuses.has(status)) throw new Error(`Invalid status: ${status}`);
        return {
          enrollmentId: r.enrollmentId,
          studentName: clean(r.studentName),
          status,
          notes: clean(r.notes) || undefined,
        };
      });
    }

    const session = await AttendanceSession.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!session) return NextResponse.json({ message: "Session not found." }, { status: 404 });
    return NextResponse.json({ session: serializeSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update session.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const existing = await AttendanceSession.findById(id).lean();
  if (!existing) return NextResponse.json({ message: "Session not found." }, { status: 404 });
  if (!(await trainerOwnsSession(authed, existing))) {
    return NextResponse.json({ message: "This session belongs to another teacher." }, { status: 403 });
  }
  await AttendanceSession.findByIdAndDelete(id);
  return NextResponse.json({ message: "Session deleted." });
}
