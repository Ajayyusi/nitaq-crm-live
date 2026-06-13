import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import { trainerStatuses, tamamStatuses, contractStatuses, paymentTypes } from "@/models/Teacher";
import { serializeTrainer } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const trainer = await Teacher.findById(id).lean();
  if (!trainer) return NextResponse.json({ message: "Trainer not found." }, { status: 404 });
  return NextResponse.json({ trainer: serializeTrainer(trainer) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    for (const f of ["fullName", "fullNameAr", "phone", "email", "emiratesId", "nationality", "specialisation", "qualifications", "tamamNumber", "notes"] as const) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("fullName" in update && !update.fullName) throw new Error("Full name is required.");
    if ("phone" in update && !update.phone) throw new Error("Phone is required.");
    if ("tamamStatus" in body && tamamStatuses.includes(clean(body.tamamStatus) as any)) {
      update.tamamStatus = clean(body.tamamStatus);
    }
    if ("contractStatus" in body && contractStatuses.includes(clean(body.contractStatus) as any)) {
      update.contractStatus = clean(body.contractStatus);
    }
    if ("paymentType" in body && paymentTypes.includes(clean(body.paymentType) as any)) {
      update.paymentType = clean(body.paymentType);
    }
    if ("status" in body && trainerStatuses.includes(clean(body.status) as any)) {
      update.status = clean(body.status);
    }
    if ("contractStartDate" in body) {
      update.contractStartDate = body.contractStartDate ? new Date(body.contractStartDate) : undefined;
    }
    if ("contractEndDate" in body) {
      update.contractEndDate = body.contractEndDate ? new Date(body.contractEndDate) : undefined;
    }
    if ("paymentRate" in body) {
      update.paymentRate = body.paymentRate ? Number(body.paymentRate) : undefined;
    }

    const trainer = await Teacher.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!trainer) return NextResponse.json({ message: "Trainer not found." }, { status: 404 });
    return NextResponse.json({ trainer: serializeTrainer(trainer) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update trainer.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const trainer = await Teacher.findByIdAndDelete(id);
  if (!trainer) return NextResponse.json({ message: "Trainer not found." }, { status: 404 });
  return NextResponse.json({ message: "Trainer deleted." });
}
