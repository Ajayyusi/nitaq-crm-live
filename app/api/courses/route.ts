import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Course from "@/models/Course";
import Subject from "@/models/Subject";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const withSubjects = searchParams.get("withSubjects") === "true";

    const query: any = {};
    if (active !== null) query.active = active === "true";

    const courses = await Course.find(query).sort({ name: 1 }).lean();

    if (withSubjects) {
      const courseIds = courses.map((c) => c._id);
      const subjects = await Subject.find({ courseId: { $in: courseIds }, active: true }).lean();
      const subjectsByCourse = subjects.reduce((acc: any, s) => {
        const key = s.courseId.toString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {});
      const coursesWithSubjects = courses.map((c) => ({
        ...c,
        subjects: subjectsByCourse[c._id.toString()] || [],
      }));
      return NextResponse.json({ courses: coursesWithSubjects });
    }

    return NextResponse.json({ courses });
  } catch (error) {
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
    const course = await Course.create({
      ...body,
      createdBy: (session.user as any).id,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
