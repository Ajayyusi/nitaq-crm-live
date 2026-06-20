import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import LearnerProfile from "@/models/LearnerProfile";
import { requireAuth } from "@/lib/api-auth";
import { serializeLearnerProfile } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { documentTypes, documentStatuses, riskLevels } from "@/models/LearnerProfile";

type RouteContext = { params: Promise<{ id: string }> };

const allowedDocTypes = new Set(documentTypes);
const allowedDocStatuses = new Set(documentStatuses);
const allowedRiskLevels = new Set(riskLevels);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const profile = await LearnerProfile.findById(id).lean();
  if (!profile) return NextResponse.json({ message: "Profile not found." }, { status: 404 });
  return NextResponse.json({ profile: serializeLearnerProfile(profile) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }

  try {
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    // Personal details
    const textFields = [
      "fullName", "phone", "email", "emiratesId", "passportNumber", "visaNumber",
      "nationality", "emergencyContactName", "emergencyContactPhone",
      "emergencyContactRelation", "riskNotes",
    ] as const;
    for (const f of textFields) {
      if (f in body) update[f] = clean(body[f]) || undefined;
    }
    if ("fullName" in update && !update.fullName) throw new Error("Full name is required.");
    if ("phone" in update && !update.phone) throw new Error("Phone is required.");

    // Boolean
    if ("photoOnFile" in body) update.photoOnFile = !!body.photoOnFile;
    if ("isActive" in body) update.isActive = !!body.isActive;

    // Date fields
    for (const f of ["emiratesIdExpiry", "passportExpiry", "visaExpiry", "dateOfBirth"] as const) {
      if (f in body) update[f] = body[f] ? new Date(body[f]) : undefined;
    }

    // Risk status
    if ("riskStatus" in body) {
      const v = clean(body.riskStatus);
      if (!allowedRiskLevels.has(v as typeof riskLevels[number])) throw new Error("Invalid risk status.");
      update.riskStatus = v;
    }

    // Document records (full replace of documents array)
    if ("documents" in body && Array.isArray(body.documents)) {
      update.documents = body.documents
        .filter((d: any) => allowedDocTypes.has(d.docType) && allowedDocStatuses.has(d.status))
        .map((d: any) => ({
          docType:    d.docType,
          label:      clean(d.label) || undefined,
          status:     d.status,
          expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
          uploadRef:  clean(d.uploadRef) || undefined,
          verifiedBy: clean(d.verifiedBy) || undefined,
          verifiedAt: d.verifiedAt ? new Date(d.verifiedAt) : undefined,
          notes:      clean(d.notes) || undefined,
        }));
    }

    // Append communication log entry
    const ops: Record<string, unknown> = { $set: update };
    if (body.appendComms && typeof body.appendComms === "string" && body.appendComms.trim()) {
      ops.$push = {
        commsLog: { note: body.appendComms.trim(), by: authed.name, at: new Date() },
      };
    }

    const profile = await LearnerProfile.findByIdAndUpdate(id, ops, {
      new: true, runValidators: true,
    });
    if (!profile) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

    const changes: string[] = [];
    if ("riskStatus" in update) changes.push(`Risk: ${String(update.riskStatus)}`);
    if (body.appendComms) changes.push("Communication logged");
    if ("documents" in update) changes.push("Documents updated");
    if (changes.length === 0) changes.push("Details updated");

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "LearnerProfile",
      entityId: id, entityLabel: profile.fullName,
      detail: changes.join(" · "),
    });

    return NextResponse.json({ profile: serializeLearnerProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
