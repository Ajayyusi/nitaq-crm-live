import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import LearnerAssessment from "@/models/LearnerAssessment";
import { requireAuth } from "@/lib/api-auth";
import { serializeLearnerAssessment } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { assessmentStatuses } from "@/models/LearnerAssessment";

type RouteContext = { params: Promise<{ id: string }> };
const allowedStatuses = new Set(assessmentStatuses);

export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  await connectDB();
  const a = await LearnerAssessment.findById(id).lean();
  if (!a) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json({ assessment: serializeLearnerAssessment(a) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "assessor", "iqa"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  try {
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ("status" in body) {
      if (!allowedStatuses.has(body.status)) throw new Error("Invalid status.");
      update.status = body.status;
    }
    if ("assessorFeedback" in body) update.assessorFeedback = String(body.assessorFeedback ?? "").trim() || undefined;
    if ("grade" in body) update.grade = String(body.grade ?? "").trim() || undefined;
    if ("submittedAt" in body) update.submittedAt = body.submittedAt ? new Date(body.submittedAt) : undefined;
    if ("markingDeadline" in body) update.markingDeadline = body.markingDeadline ? new Date(body.markingDeadline) : undefined;
    if ("dueDate" in body) update.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if ("fileRef" in body) update.fileRef = String(body.fileRef ?? "").trim() || undefined;
    if ("assignmentBrief" in body) update.assignmentBrief = String(body.assignmentBrief ?? "").trim() || undefined;

    const ops: Record<string, unknown> = { $set: update };

    // Append resubmission record
    if (body.appendResubmission && typeof body.appendResubmission === "object") {
      const r = body.appendResubmission;
      ops.$push = {
        resubmissions: {
          submittedAt: r.submittedAt ? new Date(r.submittedAt) : new Date(),
          feedback: String(r.feedback ?? "").trim() || undefined,
          grade: String(r.grade ?? "").trim() || undefined,
          by: authed.name,
        },
      };
    }

    const a = await LearnerAssessment.findByIdAndUpdate(id, ops, { new: true, runValidators: true });
    if (!a) return NextResponse.json({ message: "Not found." }, { status: 404 });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "LearnerAssessment",
      entityId: id, entityLabel: a.unitCode,
      detail: `Status: ${a.status}${a.grade ? ` · Grade: ${a.grade}` : ""}`,
    });

    return NextResponse.json({ assessment: serializeLearnerAssessment(a) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
