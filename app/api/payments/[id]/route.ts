import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { paymentMethods, paymentTypes, txStatuses } from "@/models/Financial";
import { serializePayment } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const allowedMethods = new Set<string>(paymentMethods);
const allowedTypes = new Set<string>(paymentTypes);
const allowedStatuses = new Set<string>(txStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const payment = await Payment.findById(id).lean();
  if (!payment) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
  return NextResponse.json({ payment: serializePayment(payment) });
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

    for (const f of ["studentName", "studentPhone", "course", "receiptRef", "notes", "recordedBy"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("studentName" in update && !update.studentName) throw new Error("Student name is required.");

    if ("amount" in body) {
      const amt = Number(body.amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0.");
      update.amount = amt;
    }
    if ("paymentMethod" in body) {
      const v = clean(body.paymentMethod);
      if (!allowedMethods.has(v)) throw new Error("Invalid payment method.");
      update.paymentMethod = v;
    }
    if ("paymentType" in body) {
      const v = clean(body.paymentType);
      if (!allowedTypes.has(v)) throw new Error("Invalid payment type.");
      update.paymentType = v;
    }
    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    for (const f of ["datePaid", "dueDate"] as const) {
      if (f in body) update[f] = body[f] ? new Date(body[f]) : undefined;
    }

    const payment = await Payment.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!payment) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
    return NextResponse.json({ payment: serializePayment(payment) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const payment = await Payment.findByIdAndDelete(id);
  if (!payment) return NextResponse.json({ message: "Payment not found." }, { status: 404 });
  return NextResponse.json({ message: "Payment deleted." });
}
