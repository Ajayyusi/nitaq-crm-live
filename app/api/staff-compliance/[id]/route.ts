import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import StaffCompliance from "@/models/StaffCompliance";
import { requireAuth } from "@/lib/api-auth";
import { serializeStaffCompliance } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  await connectDB();
  const record = await StaffCompliance.findById(id).lean();
  if (!record) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json({ record: serializeStaffCompliance(record) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });

  try {
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ("staffName" in body) update.staffName = String(body.staffName ?? "").trim();
    if ("staffRole" in body) update.staffRole = String(body.staffRole ?? "").trim();
    if ("email" in body) update.email = String(body.email ?? "").trim().toLowerCase() || undefined;
    if ("phone" in body) update.phone = String(body.phone ?? "").trim() || undefined;
    if ("notes" in body) update.notes = String(body.notes ?? "").trim() || undefined;
    if ("isActive" in body) update.isActive = !!body.isActive;
    if ("documents" in body && Array.isArray(body.documents)) {
      update.documents = body.documents.map((d: any) => ({
        docType:    String(d.docType ?? "").trim(),
        status:     String(d.status ?? "Missing").trim(),
        issueDate:  d.issueDate ? new Date(d.issueDate) : undefined,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
        reference:  String(d.reference ?? "").trim() || undefined,
        notes:      String(d.notes ?? "").trim() || undefined,
      }));
    }

    const record = await StaffCompliance.findByIdAndUpdate(
      id, { $set: update }, { new: true, runValidators: true }
    );
    if (!record) return NextResponse.json({ message: "Not found." }, { status: 404 });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "updated", entity: "StaffCompliance",
      entityId: id, entityLabel: record.staffName,
      detail: "compliance record updated",
    });

    return NextResponse.json({ record: serializeStaffCompliance(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
