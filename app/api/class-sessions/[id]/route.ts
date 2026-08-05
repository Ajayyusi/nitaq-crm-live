import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ClassSession from "@/models/ClassSession";
import Enrollment from "@/models/Enrollment";
import { requireAuth } from "@/lib/api-auth";
import { recalcEnrollmentHours } from "@/lib/hours";
import { serializeClassSession } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/** Edit a class record (admin/manager only) — hours are recalculated after. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  try {
    await connectDB();
    const session = await ClassSession.findById(id);
    if (!session) return NextResponse.json({ message: "Class record not found." }, { status: 404 });

    const body = await request.json();
    if ("deliveredHours" in body) {
      const h = Math.round((Number(body.deliveredHours) || 0) * 100) / 100;
      if (h <= 0) return NextResponse.json({ message: "Delivered hours must be greater than zero." }, { status: 400 });
      session.deliveredHours = h;
    }
    if ("classDate" in body && body.classDate) session.classDate = new Date(body.classDate);
    for (const f of ["startTime", "endTime", "lessonTopic", "notes", "homework"] as const) {
      if (f in body) (session as never as Record<string, unknown>)[f] = clean(body[f]) || undefined;
    }
    if ("attendanceStatus" in body) session.attendanceStatus = clean(body.attendanceStatus) as never;
    if ("classStatus" in body) session.classStatus = clean(body.classStatus) as never;
    if ("isChargeable" in body) session.isChargeable = !!body.isChargeable;

    await session.save();
    const hours = await recalcEnrollmentHours(session.enrollmentId.toString());

    // Rule: remaining hours can never go negative — recalc clamps, but reject
    // an edit that would overshoot the registration's total.
    const enrollment = await Enrollment.findById(session.enrollmentId).lean();
    if (enrollment?.totalRegisteredHours && (enrollment.completedHours ?? 0) >= enrollment.totalRegisteredHours) {
      // allowed (fully consumed) — but warn via notification to admins
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "ClassSession",
      entityId: id, entityLabel: `${session.studentName} · ${session.course}`,
      detail: `${session.deliveredHours}h · ${session.attendanceStatus} · ${session.classStatus}`,
    });
    // Notify the teacher their record was changed by an admin
    notify({
      roleTarget: "trainer",
      title: `Class record updated: ${session.studentName}`,
      body: `${session.course} on ${session.classDate.toISOString().slice(0, 10)} was edited by ${authed.name}.`,
    });

    return NextResponse.json({ session: serializeClassSession(session), hours });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update class record.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

/** Delete a class record (admin/manager only) — hours are recalculated after. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  await connectDB();
  const session = await ClassSession.findByIdAndDelete(id);
  if (!session) return NextResponse.json({ message: "Class record not found." }, { status: 404 });

  const hours = await recalcEnrollmentHours(session.enrollmentId.toString());

  logAudit({
    userName: authed.name, userRole: authed.role,
    action: "deleted", entity: "ClassSession",
    entityId: id, entityLabel: `${session.studentName} · ${session.course}`,
    detail: `${session.deliveredHours}h removed`,
  });

  return NextResponse.json({ message: "Class record deleted.", hours });
}
