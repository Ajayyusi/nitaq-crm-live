import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Course from "@/models/Course";
import { courseCategories, courseStatuses } from "@/models/Course";
import { getNextSequence } from "@/models/Counter";
import { serializeCourse } from "@/lib/serializers";

const allowedCategories = new Set<string>(courseCategories);
const allowedStatuses = new Set<string>(courseStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim();

    const query: Record<string, unknown> = {};
    if (status && allowedStatuses.has(status)) query.status = status;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ courseName: regex }, { courseCode: regex }];
    }

    const courses = await Course.find(query).sort({ courseName: 1 }).lean();
    return NextResponse.json({ courses: courses.map(serializeCourse) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load courses.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const courseName = clean(body.courseName);
    const category = clean(body.category);
    if (!courseName) throw new Error("Course name is required.");
    if (!allowedCategories.has(category)) throw new Error("Invalid category.");

    let courseCode = clean(body.courseCode).toUpperCase();
    if (!courseCode) {
      const seq = await getNextSequence("course");
      courseCode = `NITAQ-${String(seq).padStart(3, "0")}`;
    }

    const course = await Course.create({
      courseCode,
      courseName,
      category,
      description: clean(body.description) || undefined,
      durationWeeks: body.durationWeeks ? Number(body.durationWeeks) : undefined,
      totalSessions: body.totalSessions ? Number(body.totalSessions) : undefined,
      sessionsPerWeek: body.sessionsPerWeek ? Number(body.sessionsPerWeek) : undefined,
      hoursPerSession: body.hoursPerSession ? Number(body.hoursPerSession) : undefined,
      totalHours: body.totalHours ? Number(body.totalHours) : undefined,
      priceExVat: body.priceExVat ? Number(body.priceExVat) : 0,
      vatRate: body.vatRate !== undefined ? Number(body.vatRate) : 5,
      maxStudentsPerBatch: body.maxStudentsPerBatch ? Number(body.maxStudentsPerBatch) : undefined,
      status: allowedStatuses.has(clean(body.status)) ? clean(body.status) : "Active",
      speaActivity: clean(body.speaActivity) || undefined,
    });

    return NextResponse.json({ course: serializeCourse(course) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create course.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
