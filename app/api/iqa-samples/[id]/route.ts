import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import IQASample from "@/models/IQASample";
import { requireAuth } from "@/lib/api-auth";
import { serializeIQASample } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { iqaSampleStatuses, iqaOutcomes } from "@/models/IQASample";

type RouteContext = { params: Promise<{ id: string }> };
const allowedStatuses = new Set(iqaSampleStatuses);
const allowedOutcomes = new Set(iqaOutcomes);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa"]);
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
    if ("outcome" in body) {
      if (body.outcome && !allowedOutcomes.has(body.outcome)) throw new Error("Invalid outcome.");
      update.outcome = body.outcome ?? null;
    }
    if ("feedback" in body) update.feedback = String(body.feedback ?? "").trim() || undefined;
    if ("actionRequired" in body) update.actionRequired = String(body.actionRequired ?? "").trim() || undefined;
    if ("actionDueDate" in body) update.actionDueDate = body.actionDueDate ? new Date(body.actionDueDate) : undefined;
    if ("actionCompleted" in body) update.actionCompleted = !!body.actionCompleted;

    const sample = await IQASample.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!sample) return NextResponse.json({ message: "Not found." }, { status: 404 });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "IQASample",
      entityId: id, entityLabel: sample.unitCode,
      detail: `Status: ${sample.status}${sample.outcome ? ` · Outcome: ${sample.outcome}` : ""}`,
    });

    return NextResponse.json({ sample: serializeIQASample(sample) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
