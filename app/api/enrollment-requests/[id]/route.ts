import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import EnrollmentRequest, { enrollmentRequestStatuses } from "@/models/EnrollmentRequest";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  // Only admin/manager can review requests
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID." }, { status: 400 });
  }

  try {
    await connectDB();
    const body = await request.json();
    const status = (body.status ?? "").trim();
    if (!enrollmentRequestStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status." }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      status,
      reviewedBy: authed.name,
      reviewedAt: new Date(),
    };
    if (body.reviewNote) update.reviewNote = (body.reviewNote as string).trim();

    const req = await EnrollmentRequest.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!req) return NextResponse.json({ message: "Request not found." }, { status: 404 });
    return NextResponse.json({ request: serializeRequest(req) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update request.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
