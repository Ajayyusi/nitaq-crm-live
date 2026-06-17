import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { leadSources, leadStages, courseList } from "@/constants/leads";
import { serializeLead } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };
type LeadUpdatePayload = Partial<
  Record<
    | "fullName"
    | "phone"
    | "email"
    | "course"
    | "customCourse"
    | "source"
    | "stage"
    | "notes"
    | "nextFollowUpDate"
    | "assignedTo",
    string
  >
>;

const allowedStages = new Set<string>(leadStages);
const allowedSources = new Set<string>(leadSources);
const allowedCourses = new Set<string>(courseList);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildUpdate(body: LeadUpdatePayload) {
  const update: Record<string, unknown> = {};

  for (const field of [
    "fullName",
    "phone",
    "email",
    "notes",
    "assignedTo",
  ] as const) {
    if (field in body) update[field] = cleanText(body[field]) || undefined;
  }

  if ("customCourse" in body) {
    update.customCourse = cleanText(body.customCourse) || undefined;
  }

  if ("course" in body) {
    const course = cleanText(body.course) || "Other";
    if (!allowedCourses.has(course)) throw new Error("Invalid course selection.");
    update.course = course;
  }

  if ("source" in body) {
    const source = cleanText(body.source) || "Other";
    if (!allowedSources.has(source)) throw new Error("Invalid lead source.");
    update.source = source;
  }

  if ("stage" in body) {
    const stage = cleanText(body.stage) || "Lead";
    if (!allowedStages.has(stage)) throw new Error("Invalid lead stage.");
    update.stage = stage;
  }

  if ("nextFollowUpDate" in body) {
    const value = cleanText(body.nextFollowUpDate);
    update.nextFollowUpDate = value ? new Date(value) : undefined;
  }

  if ("fullName" in update && !update.fullName)
    throw new Error("Full name is required.");
  if ("phone" in update && !update.phone)
    throw new Error("Phone number is required.");

  return update;
}

async function getLeadById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  return Lead.findById(id);
}

function canAccessLead(authed: { role: string; name: string }, lead: { assignedTo?: string; createdBy?: string }) {
  if (authed.role !== "sales") return true;
  const n = authed.name.toLowerCase();
  return (
    (lead.assignedTo ?? "").toLowerCase() === n ||
    (lead.createdBy ?? "").toLowerCase() === n
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
  if (!canAccessLead(authed, lead)) return NextResponse.json({ message: "Access denied." }, { status: 403 });
  return NextResponse.json({ lead: serializeLead(lead) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid lead ID." }, { status: 400 });
    }
    await connectDB();
    const existing = await Lead.findById(id).lean();
    if (!existing) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    if (!canAccessLead(authed, existing)) return NextResponse.json({ message: "Access denied." }, { status: 403 });

    const body = (await request.json()) as LeadUpdatePayload & { appendNote?: string };
    // Sales cannot reassign leads to others
    if (authed.role === "sales") delete body.assignedTo;

    // Handle note append separately via $push
    const { appendNote, ...rest } = body;
    const updateOps: Record<string, unknown> = { $set: buildUpdate(rest as LeadUpdatePayload) };
    if (appendNote && typeof appendNote === "string" && appendNote.trim()) {
      updateOps.$push = { noteLog: { text: appendNote.trim(), by: authed.name, at: new Date() } };
    }

    const lead = await Lead.findByIdAndUpdate(id, updateOps, {
      new: true,
      runValidators: true,
    });
    if (!lead) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    return NextResponse.json({ lead: serializeLead(lead) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update lead.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid lead ID." }, { status: 400 });
  }
  await connectDB();
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
  return NextResponse.json({ message: "Lead deleted." });
}
