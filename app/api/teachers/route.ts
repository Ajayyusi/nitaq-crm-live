import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Teacher from "@/models/Teacher";
import TeacherSubject from "@/models/TeacherSubject";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const subjectId = searchParams.get("subjectId");
    const mode = searchParams.get("mode");
    const status = searchParams.get("status");

    let query: any = { active: true };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by subject/mode through TeacherSubject mapping
    if (subjectId) {
      const teacherSubjectFilter: any = { subjectId, active: true };
      if (mode === "online") teacherSubjectFilter.onlineAvailable = true;
      if (mode === "offline") teacherSubjectFilter.offlineAvailable = true;

      const mappings = await TeacherSubject.find(teacherSubjectFilter).distinct("teacherId");
      query._id = { $in: mappings };
    }

    const teachers = await Teacher.find(query).sort({ fullName: 1 }).lean();
    return NextResponse.json({ teachers });
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
    const teacher = await Teacher.create(body);
    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
