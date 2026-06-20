import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import StaffCompliance from "@/models/StaffCompliance";
import { requireAuth } from "@/lib/api-auth";
import { serializeStaffCompliance } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const records = await StaffCompliance.find({ isActive: true }).sort({ staffName: 1 }).lean();
  return NextResponse.json({ records: records.map(serializeStaffCompliance) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const staffName = String(body.staffName ?? "").trim();
    const staffRole = String(body.staffRole ?? "").trim();
    if (!staffName) return NextResponse.json({ message: "Staff name is required." }, { status: 400 });
    if (!staffRole) return NextResponse.json({ message: "Staff role is required." }, { status: 400 });

    const record = await StaffCompliance.create({
      staffName,
      staffRole,
      email:     String(body.email ?? "").trim().toLowerCase() || undefined,
      phone:     String(body.phone ?? "").trim() || undefined,
      userId:    body.userId || undefined,
      documents: [],
      notes:     String(body.notes ?? "").trim() || undefined,
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "StaffCompliance",
      entityId: record._id.toString(), entityLabel: record.staffName,
      detail: `Role: ${record.staffRole}`,
    });

    return NextResponse.json({ record: serializeStaffCompliance(record) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create record.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
