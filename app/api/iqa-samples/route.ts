import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import IQASample from "@/models/IQASample";
import { requireAuth } from "@/lib/api-auth";
import { serializeIQASample } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa"]);
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

  const samples = await IQASample.find(query).sort({ sampledAt: -1 }).lean();
  return NextResponse.json({ samples: samples.map(serializeIQASample) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(body.assessmentId))
      return NextResponse.json({ message: "Valid assessmentId required." }, { status: 400 });
    if (!mongoose.Types.ObjectId.isValid(body.learnerProfileId))
      return NextResponse.json({ message: "Valid learnerProfileId required." }, { status: 400 });
    if (!mongoose.Types.ObjectId.isValid(body.qualificationId))
      return NextResponse.json({ message: "Valid qualificationId required." }, { status: 400 });

    const sample = await IQASample.create({
      assessmentId:     body.assessmentId,
      learnerProfileId: body.learnerProfileId,
      qualificationId:  body.qualificationId,
      unitCode:         String(body.unitCode ?? "").trim(),
      sampledBy:        authed.name,
      sampledAt:        body.sampledAt ? new Date(body.sampledAt) : new Date(),
      status:           "Planned",
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "IQASample",
      entityId: sample._id.toString(), entityLabel: sample.unitCode,
      detail: "IQA sample created",
    });

    return NextResponse.json({ sample: serializeIQASample(sample) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create IQA sample.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
