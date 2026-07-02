import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FollowUp from "@/models/FollowUp";
import { followUpTypes, followUpStatuses } from "@/models/FollowUp";
import { serializeFollowUp } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const allowedTypes = new Set<string>(followUpTypes);
const allowedStatuses = new Set<string>(followUpStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

// Sales users may only touch follow-ups assigned to them or created by them.
function canAccessFollowUp(
  authed: { role: string; name: string },
  fu: { assignedTo?: string; createdBy?: string }
) {
  if (authed.role !== "sales") return true;
  const n = authed.name.toLowerCase();
  return (
    (fu.assignedTo ?? "").toLowerCase() === n ||
    (fu.createdBy ?? "").toLowerCase() === n
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;


  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
    }
    await connectDB();
    const existing = await FollowUp.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Follow-up not found." }, { status: 404 });
    if (!canAccessFollowUp(authed, existing)) {
      return NextResponse.json({ message: "Access denied." }, { status: 403 });
    }
    const body = await request.json();
    // Sales cannot reassign follow-ups to others
    if (authed.role === "sales") delete body.assignedTo;
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
    const detail = "status" in update ? `Status → ${String(update.status)}` : "Details updated";
    logAudit({ userName: authed.name, userRole: authed.role, action: "updated", entity: "FollowUp", entityId: id, entityLabel: followUp.contactName, detail });
    return NextResponse.json({ followUp: serializeFollowUp(followUp) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update follow-up.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;


  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }
  await connectDB();
  const existing = await FollowUp.findById(id).lean();
  if (!existing) {
    return NextResponse.json({ message: "Follow-up not found." }, { status: 404 });
  }
  if (!canAccessFollowUp(authed, existing)) {
    return NextResponse.json({ message: "Access denied." }, { status: 403 });
  }
  const followUp = await FollowUp.findByIdAndDelete(id);
  if (!followUp) {
    return NextResponse.json({ message: "Follow-up not found." }, { status: 404 });
  }
  logAudit({ userName: authed.name, userRole: authed.role, action: "deleted", entity: "FollowUp", entityId: id, entityLabel: followUp.contactName });
  return NextResponse.json({ message: "Follow-up deleted." });
}
