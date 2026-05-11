import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import TeacherSubject from "@/models/TeacherSubject";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const subjectId = searchParams.get("subjectId");

    const query: any = {};
    if (teacherId) query.teacherId = teacherId;
    if (subjectId) query.subjectId = subjectId;

    const mappings = await TeacherSubject.find(query)
      .populate("teacherId", "fullName")
      .populate("courseId", "name")
      .populate("subjectId", "name")
      .lean();

    return NextResponse.json({ mappings });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;
    if (!["super_admin", "admin", "academic"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await connectDB();
    const body = await req.json();
    const mapping = await TeacherSubject.create(body);
    return NextResponse.json({ mapping }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
