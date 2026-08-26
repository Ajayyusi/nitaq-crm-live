import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ClassSession from "@/models/ClassSession";
import Enrollment from "@/models/Enrollment";
import { requireAuth } from "@/lib/api-auth";
import { getTeacherForUser, isTaughtBy } from "@/lib/teacher";
import { recalcEnrollmentHours, sessionCharges } from "@/lib/hours";
import { serializeClassSession } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

/** List class sessions. Trainers only ever see their own. */
export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const query: Record<string, unknown> = {};

  const enrollmentId = searchParams.get("enrollmentId");
  if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) query.enrollmentId = enrollmentId;

  if (authed.role === "trainer") {
    const teacher = await getTeacherForUser(authed);
    if (!teacher) return NextResponse.json({ sessions: [] });
    query.teacherId = teacher._id;
  } else {
    const teacherId = searchParams.get("teacherId");
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) query.teacherId = teacherId;
  }

  const sessions = await ClassSession.find(query).sort({ classDate: -1, createdAt: -1 }).limit(500).lean();
  return NextResponse.json({ sessions: sessions.map(serializeClassSession) });
}

/**
 * Record a class session, enforcing the validation rules:
 * - trainers can only record for registrations assigned to them (their own course)
 * - delivered hours > 0 and ≤ remaining hours (for charging sessions)
 * - cancelled / absent / no-show never charge unless admin marks chargeable
 * - duplicate (registration, date, start time) blocked
 * Hours are recalculated from the session records after saving.
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const enrollmentId = clean(body.enrollmentId);
    if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return NextResponse.json({ message: "Valid registration is required." }, { status: 400 });
    }
    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    // Teacher scoping + attribution
    let teacherId = enrollment.teacherId;
    let teacherName = enrollment.teacherName ?? "";
    let isChargeable = false;

    if (authed.role === "trainer") {
      const teacher = await getTeacherForUser(authed);
      if (!teacher) {
        return NextResponse.json({ message: "No teacher profile is linked to your account — ask an admin to set your teacher email." }, { status: 403 });
      }
      if (!isTaughtBy(enrollment, teacher._id)) {
        return NextResponse.json({ message: "This student is not assigned to you." }, { status: 403 });
      }
      teacherId = teacher._id as never;
      teacherName = teacher.fullName;
      // Teachers cannot mark absences chargeable — admin only
    } else {
      isChargeable = !!body.isChargeable;
      // With several trainers on a registration, the admin says who taught
      // this session — pay follows the session, so this must be explicit.
      const picked = body.teacherId ? String(body.teacherId) : "";
      if (picked) {
        if (!isTaughtBy(enrollment, picked)) {
          return NextResponse.json(
            { message: "That trainer is not assigned to this registration." },
            { status: 400 }
          );
        }
        const { default: Teacher } = await import("@/models/Teacher");
        const t = await Teacher.findById(picked).select("fullName").lean();
        if (!t) return NextResponse.json({ message: "Trainer not found." }, { status: 404 });
        teacherId = t._id as never;
        teacherName = t.fullName;
      }
      if (!teacherId) {
        return NextResponse.json({ message: "Assign a teacher to this registration before recording classes." }, { status: 400 });
      }
    }

    const deliveredHours = Math.round((Number(body.deliveredHours) || 0) * 100) / 100;
    if (deliveredHours <= 0) {
      return NextResponse.json({ message: "Delivered hours must be greater than zero." }, { status: 400 });
    }

    const attendanceStatus = clean(body.attendanceStatus) || "Present";
    const classStatus = clean(body.classStatus) || "Completed";

    // Remaining-hours guard applies only to sessions that will charge
    const charges = sessionCharges({ classStatus, attendanceStatus, isChargeable });
    const total = enrollment.totalRegisteredHours ?? 0;
    if (charges && total > 0) {
      const remaining = Math.max(0, total - (enrollment.completedHours ?? 0));
      if (deliveredHours > remaining) {
        return NextResponse.json(
          { message: `Only ${remaining}h remain on this registration — cannot deliver ${deliveredHours}h. Ask an admin to adjust the registered hours.` },
          { status: 400 }
        );
      }
    }

    const session = await ClassSession.create({
      enrollmentId,
      studentName: enrollment.fullName,
      course: enrollment.course,
      teacherId,
      teacherName,
      classDate: body.classDate ? new Date(body.classDate) : new Date(),
      startTime: clean(body.startTime) || undefined,
      endTime: clean(body.endTime) || undefined,
      deliveredHours,
      attendanceStatus,
      classStatus,
      isChargeable,
      lessonTopic: clean(body.lessonTopic) || undefined,
      notes: clean(body.notes) || undefined,
      homework: clean(body.homework) || undefined,
      recordedBy: authed.name,
    });

    const hours = await recalcEnrollmentHours(enrollmentId);

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "ClassSession",
      entityId: session._id.toString(), entityLabel: `${enrollment.fullName} · ${enrollment.course}`,
      detail: `${deliveredHours}h · ${attendanceStatus} · ${classStatus}`,
    });

    return NextResponse.json({ session: serializeClassSession(session), hours }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "A class is already recorded for this student, date and time." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to record class.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
