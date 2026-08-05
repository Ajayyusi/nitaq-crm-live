import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import ClassSession from "@/models/ClassSession";
import { requireAuth } from "@/lib/api-auth";
import { getTeacherForUser } from "@/lib/teacher";
import { serializeEnrollment } from "@/lib/serializers";

/**
 * Teacher's own dashboard data: ONLY registrations assigned to the
 * logged-in teacher (linked by account email), plus summary stats.
 * Admin/manager may also call it to preview (returns all assigned-teacher data
 * only when they pass their own linked teacher account — otherwise empty).
 */
export async function GET() {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const teacher = await getTeacherForUser(authed);
  if (!teacher) {
    return NextResponse.json({
      linked: false,
      message: "No teacher profile is linked to this account (match by email).",
      students: [], stats: null,
    });
  }

  const enrollments = await Enrollment.find({ teacherId: teacher._id }).sort({ updatedAt: -1 }).lean();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  const day = now.getDay();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayClasses, weekCompleted, monthSessions, recent] = await Promise.all([
    ClassSession.countDocuments({ teacherId: teacher._id, classDate: { $gte: startOfDay, $lt: endOfDay } }),
    ClassSession.countDocuments({ teacherId: teacher._id, classStatus: "Completed", classDate: { $gte: weekStart } }),
    ClassSession.aggregate([
      { $match: { teacherId: teacher._id, classStatus: "Completed", classDate: { $gte: monthStart } } },
      { $group: { _id: null, hours: { $sum: "$deliveredHours" } } },
    ]),
    ClassSession.find({ teacherId: teacher._id }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const students = enrollments.map(serializeEnrollment);
  const lowHours = students.filter((s) => s.totalRegisteredHours > 0 && s.remainingHours > 0 && s.remainingHours <= 5);

  return NextResponse.json({
    linked: true,
    teacher: { id: teacher._id.toString(), name: teacher.fullName },
    students,
    stats: {
      totalStudents: enrollments.length,
      activeCourses: new Set(enrollments.map((e) => e.course)).size,
      classesToday: todayClasses,
      classesThisWeek: weekCompleted,
      hoursThisMonth: Math.round((monthSessions[0]?.hours ?? 0) * 100) / 100,
      lowHoursCount: lowHours.length,
    },
    recentSessions: recent.map((s) => ({
      id: s._id.toString(),
      studentName: s.studentName,
      course: s.course,
      classDate: s.classDate?.toISOString().slice(0, 10) ?? "",
      deliveredHours: s.deliveredHours,
      classStatus: s.classStatus,
    })),
  });
}
