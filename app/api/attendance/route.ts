import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AttendanceSession, { attendanceStatuses } from "@/models/Attendance";
import Enrollment from "@/models/Enrollment";
import { serializeSession } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { taughtByFilter, applyTaughtBy } from "@/lib/teacher";

const allowedStatuses = new Set<string>(attendanceStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const course = searchParams.get("course")?.trim();
    const batch = searchParams.get("batch")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};
    if (course) query.course = course;
    if (batch) query.batchName = batch;
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
      query.sessionDate = dateQ;
    }

    // Trainers only see their OWN sessions — never other teachers' students
    if (authed.role === "trainer") {
      const { getTeacherForUser } = await import("@/lib/teacher");
      const teacher = await getTeacherForUser(authed);
      if (!teacher) return NextResponse.json({ sessions: [] });
      query.trainerName = teacher.fullName;
    }

    const sessions = await AttendanceSession.find(query).sort({ sessionDate: -1 }).lean();
    return NextResponse.json({ sessions: sessions.map(serializeSession) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sessions.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const body = await request.json();

    const course = clean(body.course);
    if (!course) throw new Error("Course is required.");
    if (!body.sessionDate) throw new Error("Session date is required.");

    // Trainers: force the session onto their own name and restrict students
    // to enrollments assigned to THEM.
    let trainerScope: { id: unknown; name: string } | null = null;
    if (authed.role === "trainer") {
      const { getTeacherForUser } = await import("@/lib/teacher");
      const teacher = await getTeacherForUser(authed);
      if (!teacher) {
        return NextResponse.json({ message: "No teacher profile is linked to your account." }, { status: 403 });
      }
      trainerScope = { id: teacher._id, name: teacher.fullName };
      body.trainerName = teacher.fullName;
    }

    // If records not provided, auto-populate from enrolled students for this
    // course (trainers: only THEIR assigned students)
    let records = body.records;
    if (!records || !Array.isArray(records) || records.length === 0) {
      const enrollQuery: Record<string, unknown> = { course, status: "Active" };
      if (trainerScope) applyTaughtBy(enrollQuery, trainerScope.id);
      const enrollments = await Enrollment.find(enrollQuery).lean();
      records = enrollments.map((e: any) => ({
        enrollmentId: e._id.toString(),
        studentName: e.fullName,
        status: "Present",
        notes: "",
      }));
    } else if (trainerScope) {
      // Trainer supplied explicit records — drop any student not assigned to them
      const mine = await Enrollment.find(taughtByFilter(trainerScope.id)).select("_id").lean();
      const mineIds = new Set(mine.map((e) => e._id.toString()));
      records = (records as { enrollmentId?: string }[]).filter((r) => r.enrollmentId && mineIds.has(String(r.enrollmentId)));
      if (records.length === 0) {
        return NextResponse.json({ message: "None of these students are assigned to you." }, { status: 403 });
      }
    }

    // Validate records
    const validatedRecords = (records as any[]).map((r: any) => {
      const status = clean(r.status) || "Present";
      if (!allowedStatuses.has(status)) throw new Error(`Invalid status: ${status}`);
      return {
        enrollmentId: r.enrollmentId,
        studentName: clean(r.studentName),
        status,
        notes: clean(r.notes) || undefined,
      };
    });

    const session = await AttendanceSession.create({
      course,
      batchName: clean(body.batchName) || undefined,
      sessionDate: new Date(body.sessionDate),
      sessionNumber: body.sessionNumber ? Number(body.sessionNumber) : undefined,
      topic: clean(body.topic) || undefined,
      trainerName: clean(body.trainerName) || undefined,
      records: validatedRecords,
    });

    return NextResponse.json({ session: serializeSession(session) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create session.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
