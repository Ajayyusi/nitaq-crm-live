import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { leadSources, leadStatuses } from "@/constants/leads";

type RouteContext = { params: Promise<{ id: string }> };
type LeadUpdatePayload = Partial<Record<"fullName" | "phone" | "email" | "interestedCourse" | "source" | "status" | "notes" | "nextFollowUpDate" | "assignedTo", string>>;

const allowedStatuses = new Set<string>(leadStatuses);
const allowedSources = new Set<string>(leadSources);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeLead(lead: any) {
  return {
    id: lead._id.toString(),
    fullName: lead.fullName ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    interestedCourse: lead.interestedCourse ?? "",
    source: lead.source ?? "Other",
    status: lead.status ?? "New",
    notes: lead.notes ?? "",
    nextFollowUpDate: lead.nextFollowUpDate ? lead.nextFollowUpDate.toISOString().slice(0, 10) : "",
    assignedTo: lead.assignedTo ?? "",
    createdAt: lead.createdAt?.toISOString() ?? "",
    updatedAt: lead.updatedAt?.toISOString() ?? "",
  };
}

function buildUpdate(body: LeadUpdatePayload) {
  const update: Record<string, unknown> = {};

  for (const field of ["fullName", "phone", "email", "interestedCourse", "notes", "assignedTo"] as const) {
    if (field in body) update[field] = cleanText(body[field]) || undefined;
  }

  if ("nextFollowUpDate" in body) {
    const value = cleanText(body.nextFollowUpDate);
    update.nextFollowUpDate = value ? new Date(value) : undefined;
  }

  if ("source" in body) {
    const source = cleanText(body.source) || "Other";
    if (!allowedSources.has(source)) throw new Error("Invalid lead source.");
    update.source = source;
  }

  if ("status" in body) {
    const status = cleanText(body.status) || "New";
    if (!allowedStatuses.has(status)) throw new Error("Invalid lead status.");
    update.status = status;
  }

  if ("fullName" in update && !update.fullName) throw new Error("Full name is required.");
  if ("phone" in update && !update.phone) throw new Error("Phone is required.");
  if ("interestedCourse" in update && !update.interestedCourse) throw new Error("Interested course is required.");

  return update;
}

async function getLeadById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  return Lead.findById(id);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const lead = await getLeadById(id);

  if (!lead) {
    return NextResponse.json({ message: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ lead: serializeLead(lead) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid lead ID." }, { status: 400 });
    }

    await connectDB();
    const body = (await request.json()) as LeadUpdatePayload;
    const lead = await Lead.findByIdAndUpdate(id, buildUpdate(body), { new: true, runValidators: true });

    if (!lead) {
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    }

    return NextResponse.json({ lead: serializeLead(lead) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lead.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  await connectDB();
  const lead = await Lead.findByIdAndDelete(id);

  if (!lead) {
    return NextResponse.json({ message: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Lead deleted." });
}
