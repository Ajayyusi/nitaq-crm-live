import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import LearnerAssessment from "@/models/LearnerAssessment";
import { requireAuth } from "@/lib/api-auth";
import { serializeLearnerAssessment } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const qualId = searchParams.get("qualificationId");
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {};
  if (profileId && mongoose.Types.ObjectId.isValid(profileId)) query.learnerProfileId = profileId;
  if (qualId && mongoose.Types.ObjectId.isValid(qualId)) query.qualificationId = qualId;
  if (status) query.status = status;

  const assessments = await LearnerAssessment.find(query).sort({ dueDate: 1 }).lean();
  return NextResponse.json({ assessments: assessments.map(serializeLearnerAssessment) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "assessor", "iqa"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(body.learnerProfileId))
      return NextResponse.json({ message: "Valid learnerProfileId required." }, { status: 400 });
    if (!mongoose.Types.ObjectId.isValid(body.qualificationId))
      return NextResponse.json({ message: "Valid qualificationId required." }, { status: 400 });
    if (!String(body.unitCode ?? "").trim())
      return NextResponse.json({ message: "Unit code required." }, { status: 400 });

    const assessment = await LearnerAssessment.create({
      learnerProfileId: body.learnerProfileId,
      qualificationId:  body.qualificationId,
      unitCode:         String(body.unitCode).trim(),
      unitTitle:        String(body.unitTitle ?? "").trim() || undefined,
      assignmentBrief:  String(body.assignmentBrief ?? "").trim() || undefined,
      dueDate:          body.dueDate ? new Date(body.dueDate) : undefined,
      markingDeadline:  body.markingDeadline ? new Date(body.markingDeadline) : undefined,
      assessorId:       body.assessorId || undefined,
      status:           body.status ?? "Not Submitted",
      fileRef:          String(body.fileRef ?? "").trim() || undefined,
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "LearnerAssessment",
      entityId: assessment._id.toString(), entityLabel: `${assessment.unitCode}`,
      detail: `Status: ${assessment.status}`,
    });

    return NextResponse.json({ assessment: serializeLearnerAssessment(assessment) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create assessment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
