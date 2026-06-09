import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FollowUp from "@/models/FollowUp";
import { followUpTypes, followUpStatuses } from "@/models/FollowUp";
import { serializeFollowUp } from "@/lib/serializers";

type RouteContext = { params: Promise<{ id: string }> };

const allowedTypes = new Set<string>(followUpTypes);
const allowedStatuses = new Set<string>(followUpStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ("contactName" in body) {
      const v = clean(body.contactName);
      if (!v) throw new Error("Contact name is required.");
      update.contactName = v;
    }
    if ("phone" in body) {
      const v = clean(body.phone);
      if (!v) throw new Error("Phone is required.");
      update.phone = v;
    }
    if ("course" in body) update.course = clean(body.course) || undefined;
    if ("followUpDate" in body) {
      const v = clean(body.followUpDate);
      if (!v) throw new Error("Follow-up date is required.");
      update.followUpDate = new Date(v);
    }
    if ("type" in body) {
      const v = clean(body.type);
      if (!allowedTypes.has(v)) throw new Error("Invalid type.");
      update.type = v;
    }
    if ("status" in body) {
      const v = clean(body.status);
      if (!allowedStatuses.has(v)) throw new Error("Invalid status.");
      update.status = v;
    }
    if ("notes" in body) update.notes = clean(body.notes) || undefined;
    if ("assignedTo" in body) update.assignedTo = clean(body.assignedTo) || undefined;

    const followUp = await FollowUp.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!followUp) {
      return NextResponse.json({ message: "Follow-up not found." }, { status: 404 });
    }
    return NextResponse.json({ followUp: serializeFollowUp(followUp) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update follow-up.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const followUp = await FollowUp.findByIdAndDelete(id);
  if (!followUp) {
    return NextResponse.json({ message: "Follow-up not found." }, { status: 404 });
  }
  return NextResponse.json({ message: "Follow-up deleted." });
}
