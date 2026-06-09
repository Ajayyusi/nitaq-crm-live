import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats } from "@/models/Enrollment";
import { serializeEnrollment } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const allowedStatuses = new Set<string>(enrollmentStatuses);
const allowedPaymentStatuses = new Set<string>(paymentStatuses);
const allowedFormats = new Set<string>(scheduleFormats);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findById(id).lean();
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
  return NextResponse.json({ enrollment: serializeEnrollment(enrollment) });
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

    for (const f of ["fullName", "phone", "email", "emiratesId", "nationality", "course", "batchName", "schedule", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("fullName" in update && !update.fullName) throw new Error("Full name is required.");
    if ("phone" in update && !update.phone) throw new Error("Phone is required.");
    if ("course" in update && !update.course) throw new Error("Course is required.");

    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    if ("paymentStatus" in body) {
      const v = clean(body.paymentStatus);
      if (!allowedPaymentStatuses.has(v)) throw new Error("Invalid payment status.");
      update.paymentStatus = v;
    }
    if ("format" in body) {
      const v = clean(body.format);
      if (!allowedFormats.has(v)) throw new Error("Invalid format.");
      update.format = v;
    }
    for (const f of ["startDate", "endDate"] as const) {
      if (f in body) update[f] = body[f] ? new Date(body[f]) : undefined;
    }
    for (const f of ["totalFee", "amountPaid"] as const) {
      if (f in body) update[f] = Number(body[f]) || 0;
    }

    const enrollment = await Enrollment.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
    return NextResponse.json({ enrollment: serializeEnrollment(enrollment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update enrollment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findByIdAndDelete(id);
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
  return NextResponse.json({ message: "Enrollment deleted." });
}
