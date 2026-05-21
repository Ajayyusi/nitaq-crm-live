import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { leadSources, leadStatuses } from "@/constants/leads";

type LeadPayload = {
  fullName?: string;
  phone?: string;
  email?: string;
  interestedCourse?: string;
  source?: string;
  status?: string;
  notes?: string;
  nextFollowUpDate?: string;
  assignedTo?: string;
};

const allowedStatuses = new Set<string>(leadStatuses);
const allowedSources = new Set<string>(leadSources);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildLeadPayload(body: LeadPayload) {
  const fullName = cleanText(body.fullName);
  const phone = cleanText(body.phone);
  const interestedCourse = cleanText(body.interestedCourse);
  const source = cleanText(body.source) || "Other";
  const status = cleanText(body.status) || "New";

  if (!fullName) throw new Error("Full name is required.");
  if (!phone) throw new Error("Phone is required.");
  if (!interestedCourse) throw new Error("Interested course is required.");
  if (!allowedSources.has(source)) throw new Error("Invalid lead source.");
  if (!allowedStatuses.has(status)) throw new Error("Invalid lead status.");

  const email = cleanText(body.email);
  const notes = cleanText(body.notes);
  const assignedTo = cleanText(body.assignedTo);
  const nextFollowUpDate = cleanText(body.nextFollowUpDate);

  return {
    fullName,
    phone,
    email: email || undefined,
    interestedCourse,
    source,
    status,
    notes: notes || undefined,
    assignedTo: assignedTo || undefined,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
  };
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

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const source = searchParams.get("source")?.trim();
    const sort = searchParams.get("sort") === "oldest" ? 1 : -1;

    const query: Record<string, unknown> = {};

    if (status && allowedStatuses.has(status)) query.status = status;
    if (source && allowedSources.has(source)) query.source = source;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { fullName: regex },
        { phone: regex },
        { interestedCourse: regex },
        { status: regex },
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: sort }).lean();

    return NextResponse.json({ leads: leads.map(serializeLead) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leads.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = (await request.json()) as LeadPayload;
    const lead = await Lead.create(buildLeadPayload(body));
    return NextResponse.json({ lead: serializeLead(lead) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create lead.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
