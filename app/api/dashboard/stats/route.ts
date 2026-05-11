import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import { Payment } from "@/models/Financial";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const userRole = (session.user as any).role;

    if (userRole === "sales") {
      const userId = (session.user as any).id;
      const [newLeadsToday, leadsThisWeek, followUpsDue, enrolledThisMonth] = await Promise.all([
        Lead.countDocuments({ assignedSalesUser: userId, createdAt: { $gte: today } }),
        Lead.countDocuments({ assignedSalesUser: userId, createdAt: { $gte: startOfWeek } }),
        Lead.countDocuments({ assignedSalesUser: userId, followUpDate: { $lte: now }, status: { $nin: ["enrolled", "lost"] } }),
        Lead.countDocuments({ assignedSalesUser: userId, status: "enrolled", updatedAt: { $gte: startOfMonth } }),
      ]);

      const leadsByStatus = await Lead.aggregate([
        { $match: { assignedSalesUser: { $exists: true } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      return NextResponse.json({
        newLeadsToday, leadsThisWeek, followUpsDue, enrolledThisMonth, leadsByStatus,
      });
    }

    // Admin / Super Admin dashboard
    const [
      totalLeads, totalStudents, totalTeachers, totalCourses,
      activeEnrollments, newLeadsThisMonth, revenueThisMonth,
    ] = await Promise.all([
      Lead.countDocuments(),
      Student.countDocuments({ active: true }),
      Teacher.countDocuments({ active: true }),
      Course.countDocuments({ active: true }),
      Enrollment.countDocuments({ status: "active" }),
      Lead.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Payment.aggregate([
        { $match: { paymentDate: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const leadsByStatus = await Lead.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const enrollmentsByMonth = await Enrollment.aggregate([
      { $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: "$finalPrice" },
      }},
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    return NextResponse.json({
      totalLeads, totalStudents, totalTeachers, totalCourses,
      activeEnrollments, newLeadsThisMonth,
      revenueThisMonth: revenueThisMonth[0]?.total || 0,
      leadsByStatus, enrollmentsByMonth,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
