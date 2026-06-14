import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import { getNextSequence } from "@/models/Counter";
import { leadSources, leadStages, courseList } from "@/constants/leads";
import { serializeLead } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";

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
  createdBy?: string;
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

  const createdBy = cleanText(body.createdBy);

  return {
    fullName,
    phone,
    email: email || undefined,
    course,
    source,
    stage,
    notes: notes || undefined,
    assignedTo: assignedTo || undefined,
    createdBy: createdBy || undefined,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
  };
}


export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const stage = searchParams.get("stage")?.trim();
    const source = searchParams.get("source")?.trim();
    const sort = searchParams.get("sort") === "oldest" ? 1 : -1;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};

    // Sales users only see leads assigned to or created by them
    if (authed.role === "sales") {
      const nameEsc = authed.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nameRx = new RegExp(`^${nameEsc}$`, "i");
      query.$or = [{ assignedTo: nameRx }, { createdBy: nameRx }];
    }

    if (stage && allowedStages.has(stage)) query.stage = stage;
    if (source && allowedSources.has(source)) query.source = source;
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
      query.createdAt = dateQ;
    }
    if (search) {
      const searchRx = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      // For sales users, combine ownership filter with search using $and
      if (query.$or) {
        const ownershipFilter = query.$or;
        delete query.$or;
        query.$and = [
          { $or: ownershipFilter as unknown[] },
          { $or: [{ fullName: searchRx }, { phone: searchRx }, { course: searchRx }, { leadId: searchRx }] },
        ];
      } else {
        query.$or = [
          { fullName: searchRx },
          { phone: searchRx },
          { course: searchRx },
          { leadId: searchRx },
        ];
      }
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
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = (await request.json()) as LeadPayload;
    const payload = buildLeadPayload(body);

    // Sales users: auto-assign to themselves; override any submitted assignedTo
    if (authed.role === "sales") {
      payload.assignedTo = authed.name;
      payload.createdBy = authed.name;
    } else if (!payload.createdBy) {
      payload.createdBy = authed.name;
    }

    // Duplicate phone detection
    const phoneNorm = payload.phone.replace(/\s+/g, "");
    const existing = await Lead.findOne({ phone: new RegExp(`^${phoneNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).lean();
    if (existing) {
      return NextResponse.json({
        message: `A lead with this phone number already exists (${existing.leadId} — ${existing.fullName}).`,
        duplicate: serializeLead(existing),
      }, { status: 409 });
    }

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
