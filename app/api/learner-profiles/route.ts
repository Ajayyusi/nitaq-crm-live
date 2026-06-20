import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import LearnerProfile from "@/models/LearnerProfile";
import Enrollment from "@/models/Enrollment";
import { requireAuth } from "@/lib/api-auth";
import { serializeLearnerProfile } from "@/lib/serializers";
import { logAudit } from "@/lib/audit";
import { documentTypes, documentStatuses, riskLevels } from "@/models/LearnerProfile";

const allowedDocTypes = new Set(documentTypes);
const allowedDocStatuses = new Set(documentStatuses);
const allowedRiskLevels = new Set(riskLevels);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "eqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const risk = searchParams.get("risk")?.trim();
  const search = searchParams.get("search")?.trim();
  const active = searchParams.get("active");

  const query: Record<string, unknown> = {};
  if (risk && allowedRiskLevels.has(risk as typeof riskLevels[number])) query.riskStatus = risk;
  if (active !== null && active !== "") query.isActive = active !== "false";
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ fullName: rx }, { phone: rx }, { emiratesId: rx }];
  }

  const profiles = await LearnerProfile.find(query).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ profiles: profiles.map(serializeLearnerProfile) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "iqa", "assessor"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    // Require an enrollmentId to link the profile
    const enrollmentId = clean(body.enrollmentId);
    if (!enrollmentId || !mongoose.Types.ObjectId.isValid(enrollmentId)) {
      return NextResponse.json({ message: "Valid enrollment ID is required." }, { status: 400 });
    }

    // Prevent duplicate profiles
    const existing = await LearnerProfile.findOne({ enrollmentId });
    if (existing) {
      return NextResponse.json(
        { message: "A compliance profile already exists for this enrollment.", profileId: existing._id.toString() },
        { status: 409 }
      );
    }

    // Auto-fill from Enrollment if available
    const enrollment = await Enrollment.findById(enrollmentId).lean();
    if (!enrollment) {
      return NextResponse.json({ message: "Enrollment not found." }, { status: 404 });
    }

    const profile = await LearnerProfile.create({
      enrollmentId,
      fullName:   clean(body.fullName)   || enrollment.fullName,
      phone:      clean(body.phone)      || enrollment.phone,
      email:      clean(body.email)      || enrollment.email || undefined,
      emiratesId: clean(body.emiratesId) || enrollment.emiratesId || undefined,
      nationality: clean(body.nationality) || enrollment.nationality || undefined,
      photoOnFile:  !!body.photoOnFile,
      riskStatus:   allowedRiskLevels.has(body.riskStatus) ? body.riskStatus : "Low",
      riskNotes:    clean(body.riskNotes) || undefined,
      emergencyContactName:     clean(body.emergencyContactName) || undefined,
      emergencyContactPhone:    clean(body.emergencyContactPhone) || undefined,
      emergencyContactRelation: clean(body.emergencyContactRelation) || undefined,
      documents: [],
      commsLog:  [],
    });

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "LearnerProfile",
      entityId: profile._id.toString(), entityLabel: profile.fullName,
      detail: `Risk: ${profile.riskStatus}`,
    });

    return NextResponse.json({ profile: serializeLearnerProfile(profile) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create learner profile.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
