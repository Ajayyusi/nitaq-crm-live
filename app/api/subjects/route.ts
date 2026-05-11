import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Subject from "@/models/Subject";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const query: any = {};
    if (courseId) query.courseId = courseId;

    const subjects = await Subject.find(query)
      .populate("courseId", "name")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({ subjects });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;
    if (!["super_admin", "admin"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await connectDB();
    const body = await req.json();
    const subject = await Subject.create(body);
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
