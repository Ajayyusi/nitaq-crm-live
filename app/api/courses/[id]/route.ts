import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Course from "@/models/Course";
import {
  courseCategories,
  courseStatuses,
  batchFormats,
  batchStatuses,
} from "@/models/Course";
import { serializeCourse } from "@/lib/serializers";
import { getNextSequence } from "@/models/Counter";

type RouteContext = { params: Promise<{ id: string }> };

const allowedCategories = new Set<string>(courseCategories);
const allowedStatuses = new Set<string>(courseStatuses);
const allowedFormats = new Set<string>(batchFormats);
const allowedBatchStatuses = new Set<string>(batchStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const course = await Course.findById(id).lean();
  if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });
  return NextResponse.json({ course: serializeCourse(course) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ("courseName" in body) {
      const v = clean(body.courseName);
      if (!v) throw new Error("Course name is required.");
      update.courseName = v;
    }
    if ("category" in body) {
      const v = clean(body.category);
      if (!allowedCategories.has(v)) throw new Error("Invalid category.");
      update.category = v;
    }
    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    for (const f of ["description", "speaActivity"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    for (const f of [
      "durationWeeks", "totalSessions", "sessionsPerWeek",
      "hoursPerSession", "totalHours", "priceExVat", "vatRate", "maxStudentsPerBatch",
    ] as const) {
      if (f in body && body[f] !== "" && body[f] !== null) {
        update[f] = Number(body[f]);
      }
    }

    const course = await Course.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });
    return NextResponse.json({ course: serializeCourse(course) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update course.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const course = await Course.findByIdAndDelete(id);
  if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });
  return NextResponse.json({ message: "Course deleted." });
}

// POST /api/courses/[id]/batches
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid course ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();
    const batchName = clean(body.batchName);
    const format = clean(body.format) || "In-Person";
    const status = clean(body.status) || "Open";

    if (!batchName) throw new Error("Batch name is required.");
    if (!allowedFormats.has(format)) throw new Error("Invalid format.");
    if (!allowedBatchStatuses.has(status)) throw new Error("Invalid batch status.");

    const seq = await getNextSequence(`batch-${id}`);
    const batchId = `B-${String(seq).padStart(3, "0")}`;

    const course = await Course.findByIdAndUpdate(
      id,
      {
        $push: {
          batches: {
            batchId,
            batchName,
            format,
            status,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : undefined,
            schedule: clean(body.schedule) || undefined,
            trainerName: clean(body.trainerName) || undefined,
            maxStudents: body.maxStudents ? Number(body.maxStudents) : undefined,
          },
        },
      },
      { new: true },
    );

    if (!course) return NextResponse.json({ message: "Course not found." }, { status: 404 });
    return NextResponse.json({ course: serializeCourse(course) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add batch.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
