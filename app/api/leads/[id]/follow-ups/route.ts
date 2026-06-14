import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FollowUp from "@/models/FollowUp";
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
  const followUps = await FollowUp.find({ leadId: new mongoose.Types.ObjectId(id) })
    .sort({ followUpDate: 1, createdAt: -1 })
    .lean();

  return NextResponse.json({ followUps: followUps.map(serializeFollowUp) });
}
