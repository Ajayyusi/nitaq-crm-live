import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Qualification from "@/models/Qualification";
import { requireAuth } from "@/lib/api-auth";
import { serializeQualification } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const quals = await Qualification.find({}).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ qualifications: quals.map(serializeQualification) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const qual = await Qualification.create({
      title:             String(body.title ?? "").trim(),
      awardingBody:      String(body.awardingBody ?? "").trim(),
      level:             String(body.level ?? "").trim(),
      qualificationCode: String(body.qualificationCode ?? "").trim() || undefined,
      credits:           body.credits != null ? Number(body.credits) : undefined,
      glh:               body.glh != null ? Number(body.glh) : undefined,
      tqt:               body.tqt != null ? Number(body.tqt) : undefined,
      tutorId:           body.tutorId || undefined,
      assessorId:        body.assessorId || undefined,
      iqaId:             body.iqaId || undefined,
      status:            body.status ?? "Active",
      units:             Array.isArray(body.units) ? body.units : [],
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "Qualification",
      entityId: qual._id.toString(), entityLabel: qual.title,
      detail: `${qual.awardingBody} · Level ${qual.level}`,
    });

    return NextResponse.json({ qualification: serializeQualification(qual) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create qualification.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
