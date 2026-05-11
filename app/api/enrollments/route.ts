import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const teacherId = searchParams.get("teacherId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const query: any = {};
    if (studentId) query.studentId = studentId;
    if (teacherId) query.teacherId = teacherId;
    if (status) query.status = status;

    // Teacher only sees own enrollments
    const userRole = (session.user as any).role;
    if (userRole === "teacher") {
      const teacherId = (session.user as any).teacherId;
      if (teacherId) query.teacherId = teacherId;
    }

    const skip = (page - 1) * limit;
    const [enrollments, total] = await Promise.all([
      Enrollment.find(query)
        .populate("studentId", "fullName phone")
        .populate("teacherId", "fullName")
        .populate("courseId", "name")
        .populate("subjectId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments(query),
    ]);

    return NextResponse.json({
      enrollments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
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
    const enrollment = await Enrollment.create({
      ...body,
      createdBy: (session.user as any).id,
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
