import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Class from "@/models/Class";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const teacherId = searchParams.get("teacherId");
    const studentId = searchParams.get("studentId");

    const query: any = {};
    if (status) query.status = status;
    if (teacherId) query.teacherId = teacherId;
    if (studentId) query.studentId = studentId;
    if (date) {
      const d = new Date(date);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      query.classDate = { $gte: d, $lt: next };
    }

    // Teacher only sees own classes
    const userRole = (session.user as any).role;
    if (userRole === "teacher") {
      const tId = (session.user as any).teacherId;
      if (tId) query.teacherId = tId;
    }

    const classes = await Class.find(query)
      .populate("teacherId", "fullName phone")
      .populate("studentId", "fullName phone")
      .populate("subjectId", "name")
      .sort({ classDate: 1, startTime: 1 })
      .lean();

    return NextResponse.json({ classes });
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
    const cls = await Class.create(body);
    return NextResponse.json({ class: cls }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
