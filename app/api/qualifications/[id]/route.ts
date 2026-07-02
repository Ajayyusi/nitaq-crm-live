import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Qualification, { qualificationStatuses } from "@/models/Qualification";
import { requireAuth } from "@/lib/api-auth";
import { serializeQualification } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { sanitizeUnits } from "@/lib/qualification-utils";

const allowedQualStatuses = new Set<string>(qualificationStatuses);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  await connectDB();
  const qual = await Qualification.findById(id).lean();
  if (!qual) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json({ qualification: serializeQualification(qual) });
}

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

    if ("title" in body) update.title = String(body.title).trim();
    if ("awardingBody" in body) update.awardingBody = String(body.awardingBody).trim();
    if ("level" in body) update.level = String(body.level).trim();
    if ("qualificationCode" in body) update.qualificationCode = String(body.qualificationCode).trim() || undefined;
    if ("credits" in body) update.credits = body.credits != null ? Number(body.credits) : undefined;
    if ("glh" in body) update.glh = body.glh != null ? Number(body.glh) : undefined;
    if ("tqt" in body) update.tqt = body.tqt != null ? Number(body.tqt) : undefined;
    if ("tutorId" in body) update.tutorId = body.tutorId || undefined;
    if ("assessorId" in body) update.assessorId = body.assessorId || undefined;
    if ("iqaId" in body) update.iqaId = body.iqaId || undefined;
    if ("status" in body) {
      if (!allowedQualStatuses.has(body.status)) throw new Error("Invalid status.");
      update.status = body.status;
    }
    if ("units" in body && Array.isArray(body.units)) update.units = sanitizeUnits(body.units);

    const qual = await Qualification.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!qual) return NextResponse.json({ message: "Not found." }, { status: 404 });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "Qualification",
      entityId: id, entityLabel: qual.title,
      detail: "Details updated",
    });

    return NextResponse.json({ qualification: serializeQualification(qual) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
