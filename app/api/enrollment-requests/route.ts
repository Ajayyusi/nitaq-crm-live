import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import EnrollmentRequest from "@/models/EnrollmentRequest";
import { requireAuth } from "@/lib/api-auth";

function serializeRequest(r: any) {
  return {
    id: r._id.toString(),
    leadId: r.leadId?.toString() ?? null,
    leadRef: r.leadRef ?? "",
    leadName: r.leadName ?? "",
    leadPhone: r.leadPhone ?? "",
    course: r.course ?? "",
    salesName: r.salesName ?? "",
    salesEmail: r.salesEmail ?? "",
    notes: r.notes ?? "",
    expectedStartDate: r.expectedStartDate ? r.expectedStartDate.toISOString().slice(0, 10) : "",
    status: r.status ?? "Pending",
    reviewedBy: r.reviewedBy ?? "",
    reviewNote: r.reviewNote ?? "",
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : "",
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
  };
}

export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  const query: Record<string, unknown> = {};

  // Sales users only see their own requests
  if (authed.role === "sales") {
    query.salesEmail = authed.email;
  }
  if (status) query.status = status;

  const requests = await EnrollmentRequest.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ requests: requests.map(serializeRequest) });
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager", "sales"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();

    const leadName = (body.leadName ?? "").trim();
    const leadPhone = (body.leadPhone ?? "").trim();
    const course = (body.course ?? "").trim();

    if (!leadName) return NextResponse.json({ message: "Lead name is required." }, { status: 400 });
    if (!leadPhone) return NextResponse.json({ message: "Phone is required." }, { status: 400 });
    if (!course) return NextResponse.json({ message: "Course is required." }, { status: 400 });

    const req = await EnrollmentRequest.create({
      leadId: body.leadId || undefined,
      leadRef: (body.leadRef ?? "").trim() || undefined,
      leadName,
      leadPhone,
      course,
      salesName: authed.name,
      salesEmail: authed.email,
      notes: (body.notes ?? "").trim() || undefined,
      expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : undefined,
      status: "Pending",
    });

    return NextResponse.json({ request: serializeRequest(req) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit request.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
