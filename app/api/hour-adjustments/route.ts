import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import HourAdjustment, { adjustmentTypes } from "@/models/HourAdjustment";
import Enrollment from "@/models/Enrollment";
import { requireAuth } from "@/lib/api-auth";
import { recalcEnrollmentHours } from "@/lib/hours";
import { logAudit } from "@/lib/audit";

const allowedTypes = new Set<string>(adjustmentTypes);

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const enrollmentId = searchParams.get("enrollmentId");
  const query: Record<string, unknown> = {};
  if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) query.enrollmentId = enrollmentId;

  const adjustments = await HourAdjustment.find(query).sort({ createdAt: -1 }).limit(200).lean();
  return NextResponse.json({
    adjustments: adjustments.map((a) => ({
      id: a._id.toString(),
      enrollmentId: a.enrollmentId.toString(),
      adjustmentType: a.adjustmentType,
      hours: a.hours,
      reason: a.reason,
      createdBy: a.createdBy,
      createdAt: a.createdAt?.toISOString() ?? "",
    })),
  });
}

/** Manual hour adjustment — admin/manager only, reason is mandatory. */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const enrollmentId = String(body.enrollmentId ?? "");
    if (!mongoose.Types.ObjectId.isValid(enrollmentId))
      return NextResponse.json({ message: "Valid registration is required." }, { status: 400 });
    const enrollment = await Enrollment.findById(enrollmentId).lean();
    if (!enrollment) return NextResponse.json({ message: "Registration not found." }, { status: 404 });

    const adjustmentType = String(body.adjustmentType ?? "");
    if (!allowedTypes.has(adjustmentType))
      return NextResponse.json({ message: "Invalid adjustment type." }, { status: 400 });

    const hours = Math.round((Number(body.hours) || 0) * 100) / 100;
    if (hours <= 0) return NextResponse.json({ message: "Hours must be greater than zero." }, { status: 400 });

    const reason = String(body.reason ?? "").trim();
    if (reason.length < 3) return NextResponse.json({ message: "A reason is required for every adjustment." }, { status: 400 });

    const adjustment = await HourAdjustment.create({
      enrollmentId, adjustmentType, hours, reason, createdBy: authed.name,
    });
    const result = await recalcEnrollmentHours(enrollmentId);

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "HourAdjustment",
      entityId: adjustment._id.toString(),
      entityLabel: `${enrollment.fullName} · ${enrollment.course}`,
      detail: `${adjustmentType}: ${hours}h — ${reason}`,
    });

    return NextResponse.json({ adjustment: { id: adjustment._id.toString() }, hours: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add adjustment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
