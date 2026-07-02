import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FollowUp from "@/models/FollowUp";
import Lead from "@/models/Lead";
import { serializeFollowUp } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }

  await connectDB();

  // Sales can only view follow-ups of leads they own (same rule as /api/leads/[id])
  if (authed.role === "sales") {
    const lead = await Lead.findById(id).select("assignedTo createdBy").lean();
    if (!lead) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    const n = authed.name.toLowerCase();
    const owns =
      (lead.assignedTo ?? "").toLowerCase() === n ||
      (lead.createdBy ?? "").toLowerCase() === n;
    if (!owns) return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  const followUps = await FollowUp.find({ leadId: new mongoose.Types.ObjectId(id) })
    .sort({ followUpDate: 1, createdAt: -1 })
    .lean();

  return NextResponse.json({ followUps: followUps.map(serializeFollowUp) });
}
