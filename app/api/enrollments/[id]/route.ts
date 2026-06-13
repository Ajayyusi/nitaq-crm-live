import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats } from "@/models/Enrollment";
import { Payment, paymentMethods } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeEnrollment } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

const allowedPaymentMethods = new Set<string>(paymentMethods);

function derivePaymentType(paymentStatus: string, isFirstPayment: boolean): string {
  if (paymentStatus === "Instalment 1 Paid" || paymentStatus === "Instalment 2 Pending") {
    return "Instalment 1 of 2";
  }
  if (paymentStatus === "Paid Full" && !isFirstPayment) {
    return "Instalment 2 of 2";
  }
  return "Full Payment";
}

type RouteContext = { params: Promise<{ id: string }> };

const allowedStatuses = new Set<string>(enrollmentStatuses);
const allowedPaymentStatuses = new Set<string>(paymentStatuses);
const allowedFormats = new Set<string>(scheduleFormats);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales", "finance"]);
  if (authed instanceof NextResponse) return authed;


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
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();

    const existing = await Enrollment.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
    const oldAmountPaid: number = existing.amountPaid ?? 0;

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

    const newAmountPaid: number = enrollment.amountPaid ?? 0;
    const delta = newAmountPaid - oldAmountPaid;
    if (delta > 0) {
      const currentStatus = (update.paymentStatus as string | undefined) ?? enrollment.paymentStatus;
      const paymentType = derivePaymentType(currentStatus, oldAmountPaid === 0);
      const rawMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
      const paymentMethod = allowedPaymentMethods.has(rawMethod) ? rawMethod : "Cash";
      const seq = await getNextSequence("payment");
      const paymentId = `P-${String(seq).padStart(3, "0")}`;
      await Payment.create({
        paymentId,
        enrollmentId: enrollment._id,
        studentName: enrollment.fullName,
        studentPhone: enrollment.phone || undefined,
        course: enrollment.course || undefined,
        amount: delta,
        paymentType,
        paymentMethod,
        status: "Received",
        datePaid: new Date(),
        notes: `Auto-recorded from enrollment ${enrollment.enrollmentId}`,
      });
    }

    return NextResponse.json({ enrollment: serializeEnrollment(enrollment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update enrollment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const enrollment = await Enrollment.findByIdAndDelete(id);
  if (!enrollment) return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
  return NextResponse.json({ message: "Enrollment deleted." });
}
