import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { getNextSequence } from "@/models/Counter";
import { leadSources, leadStages, courseList } from "@/constants/leads";
import { serializeLead } from "@/lib/serializers";

type LeadPayload = {
  fullName?: string;
  phone?: string;
  email?: string;
  course?: string;
  source?: string;
  stage?: string;
  notes?: string;
  nextFollowUpDate?: string;
  assignedTo?: string;
};

const allowedStages = new Set<string>(leadStages);
const allowedSources = new Set<string>(leadSources);
const allowedCourses = new Set<string>(courseList);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildLeadPayload(body: LeadPayload) {
  const fullName = cleanText(body.fullName);
  const phone = cleanText(body.phone);
  const course = cleanText(body.course) || "Other";
  const source = cleanText(body.source) || "Other";
  const stage = cleanText(body.stage) || "Lead";

  if (!fullName) throw new Error("Full name is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!allowedCourses.has(course)) throw new Error("Invalid course selection.");
  if (!allowedSources.has(source)) throw new Error("Invalid lead source.");
  if (!allowedStages.has(stage)) throw new Error("Invalid lead stage.");

  const email = cleanText(body.email);
  const notes = cleanText(body.notes);
  const assignedTo = cleanText(body.assignedTo);
  const nextFollowUpDate = cleanText(body.nextFollowUpDate);

  return {
    fullName,
    phone,
    email: email || undefined,
    course,
    source,
    stage,
    notes: notes || undefined,
    assignedTo: assignedTo || undefined,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
  };
}


export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const stage = searchParams.get("stage")?.trim();
    const source = searchParams.get("source")?.trim();
    const sort = searchParams.get("sort") === "oldest" ? 1 : -1;

    const query: Record<string, unknown> = {};

    if (stage && allowedStages.has(stage)) query.stage = stage;
    if (source && allowedSources.has(source)) query.source = source;
    if (search) {
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [
        { fullName: regex },
        { phone: regex },
        { course: regex },
        { leadId: regex },
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: sort }).lean();
    return NextResponse.json({ leads: leads.map(serializeLead) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load leads.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = (await request.json()) as LeadPayload;
    const payload = buildLeadPayload(body);
    const seq = await getNextSequence("lead");
    const leadId = `L-${String(seq).padStart(3, "0")}`;
    const lead = await Lead.create({ ...payload, leadId });
    return NextResponse.json({ lead: serializeLead(lead) }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create lead.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
