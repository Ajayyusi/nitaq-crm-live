import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats } from "@/models/Enrollment";
import { getNextSequence } from "@/models/Counter";
import { serializeEnrollment } from "@/lib/serializers";

const allowedStatuses = new Set<string>(enrollmentStatuses);
const allowedPaymentStatuses = new Set<string>(paymentStatuses);
const allowedFormats = new Set<string>(scheduleFormats);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const payStatus = searchParams.get("paymentStatus")?.trim();
    const course = searchParams.get("course")?.trim();
    const search = searchParams.get("search")?.trim();

    const query: Record<string, unknown> = {};
    if (status && allowedStatuses.has(status)) query.status = status;
    if (payStatus && allowedPaymentStatuses.has(payStatus)) query.paymentStatus = payStatus;
    if (course) query.course = course;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ fullName: regex }, { phone: regex }, { enrollmentId: regex }];
    }

    const enrollments = await Enrollment.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ enrollments: enrollments.map(serializeEnrollment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load enrollments.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const fullName = clean(body.fullName);
    const phone = clean(body.phone);
    const course = clean(body.course);

    if (!fullName) throw new Error("Full name is required.");
    if (!phone) throw new Error("Phone is required.");
    if (!course) throw new Error("Course is required.");

    const status = clean(body.status) || "Active";
    const paymentStatus = clean(body.paymentStatus) || "Instalment 1 Paid";
    const format = clean(body.format) || "In-Person";

    if (!allowedStatuses.has(status)) throw new Error("Invalid status.");
    if (!allowedPaymentStatuses.has(paymentStatus)) throw new Error("Invalid payment status.");
    if (!allowedFormats.has(format)) throw new Error("Invalid format.");

    const seq = await getNextSequence("enrollment");
    const enrollmentId = `E-${String(seq).padStart(3, "0")}`;

    const enrollment = await Enrollment.create({
      enrollmentId,
      fullName, phone, course,
      email: clean(body.email) || undefined,
      emiratesId: clean(body.emiratesId) || undefined,
      nationality: clean(body.nationality) || undefined,
      batchName: clean(body.batchName) || undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      schedule: clean(body.schedule) || undefined,
      format, status, paymentStatus,
      totalFee: Number(body.totalFee) || 0,
      amountPaid: Number(body.amountPaid) || 0,
      notes: clean(body.notes) || undefined,
      leadId: body.leadId || undefined,
    });

    return NextResponse.json({ enrollment: serializeEnrollment(enrollment) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create enrollment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
