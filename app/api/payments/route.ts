import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const query: any = {};
    if (studentId) query.studentId = studentId;
    const payments = await Payment.find(query)
      .populate("studentId", "fullName phone")
      .populate("enrollmentId", "finalPrice courseId")
      .sort({ paymentDate: -1 })
      .lean();
    return NextResponse.json({ payments });
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
    const payment = await Payment.create({
      ...body,
      createdBy: (session.user as any).id,
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
