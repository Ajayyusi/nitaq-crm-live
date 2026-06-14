import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FollowUp from "@/models/FollowUp";
import { followUpTypes, followUpStatuses } from "@/models/FollowUp";
import { serializeFollowUp } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

const allowedTypes = new Set<string>(followUpTypes);
const allowedStatuses = new Set<string>(followUpStatuses);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const view = searchParams.get("view")?.trim(); // "today" | "overdue" | "upcoming"
    const assignedTo = searchParams.get("assignedTo")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};

    // Sales users only see follow-ups they created or are assigned to
    if (authed.role === "sales") {
      const nameEsc = authed.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nameRx = new RegExp(`^${nameEsc}$`, "i");
      query.$or = [{ assignedTo: nameRx }, { createdBy: nameRx }];
    } else if (assignedTo) {
      query.assignedTo = new RegExp(
        assignedTo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
    }

    if (status && allowedStatuses.has(status)) {
      query.status = status;
    }

    // Date range filter on followUpDate — only when no specific view is selected
    if (!view || view === "all") {
      if (from || to) {
        const dateQ: Record<string, Date> = {};
        if (from) dateQ.$gte = new Date(from);
        if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
        query.followUpDate = dateQ;
      }
    }

    if (view === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.followUpDate = { $gte: start, $lt: end };
    } else if (view === "overdue") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.followUpDate = { $lt: today };
      query.status = "Pending";
    } else if (view === "upcoming") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.followUpDate = { $gte: start };
    }

    const followUps = await FollowUp.find(query)
      .sort({ followUpDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ followUps: followUps.map(serializeFollowUp) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load follow-ups.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const contactName = clean(body.contactName);
    const phone = clean(body.phone);
    const followUpDateStr = clean(body.followUpDate);
    const type = clean(body.type) || "WhatsApp Message";
    const status = clean(body.status) || "Pending";

    if (!contactName) throw new Error("Contact name is required.");
    if (!phone) throw new Error("Phone number is required.");
    if (!followUpDateStr) throw new Error("Follow-up date is required.");
    if (!allowedTypes.has(type)) throw new Error("Invalid follow-up type.");
    if (!allowedStatuses.has(status)) throw new Error("Invalid status.");

    // Sales: auto-set assignedTo and createdBy to themselves
    const assignedTo = authed.role === "sales" ? authed.name : (clean(body.assignedTo) || undefined);
    const createdBy = authed.name;

    const followUp = await FollowUp.create({
      contactName,
      phone,
      course: clean(body.course) || undefined,
      followUpDate: new Date(followUpDateStr),
      type,
      status,
      notes: clean(body.notes) || undefined,
      assignedTo,
      createdBy,
      leadId: body.leadId || undefined,
    });

    return NextResponse.json({ followUp: serializeFollowUp(followUp) }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create follow-up.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

