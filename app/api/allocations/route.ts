import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Allocation from "@/models/Allocation";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    const status = searchParams.get("status");
    const query: any = {};
    if (leadId) query.leadId = leadId;
    if (status) query.status = status;

    const allocations = await Allocation.find(query)
      .populate("leadId", "studentName studentPhone courseId subjectId mode")
      .populate("teacherId", "fullName phone email")
      .populate("backupTeacherId", "fullName phone")
      .populate("allocatedBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ allocations });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const allocation = await Allocation.create({
      ...body,
      allocatedBy: (session.user as any).id,
      allocationDate: new Date(),
    });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
