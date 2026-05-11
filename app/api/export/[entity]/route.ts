import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { auth } from "@/lib/auth";
import Lead from "@/models/Lead";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Enrollment from "@/models/Enrollment";
import { Payment, Expense } from "@/models/Financial";

type Ctx = { params: Promise<{ entity: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { entity } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    let rows: any[] = [];

    if (entity === "leads") {
      const leads = await Lead.find().populate("courseId", "name").populate("subjectId", "name").populate("assignedSalesUser", "name").lean();
      rows = leads.map((l) => ({ studentName: l.studentName, studentPhone: l.studentPhone, parentPhone: l.parentPhone || "", email: l.email || "", course: (l.courseId as any)?.name || "", subject: (l.subjectId as any)?.name || "", mode: l.mode || "", leadSource: l.leadSource, status: l.status, followUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString().split("T")[0] : "", notes: l.notes || "", createdAt: new Date(l.createdAt).toISOString().split("T")[0] }));
    } else if (entity === "teachers") {
      const teachers = await Teacher.find().lean();
      rows = teachers.map((t) => ({ fullName: t.fullName, phone: t.phone, whatsapp: t.whatsapp || "", email: t.email || "", jobTitle: t.jobTitle || "", employmentType: t.employmentType, status: t.status, branchPreference: t.branchPreference || "", createdAt: new Date(t.createdAt).toISOString().split("T")[0] }));
    } else if (entity === "students") {
      const students = await Student.find().lean();
      rows = students.map((s) => ({ fullName: s.fullName, phone: s.phone, parentPhone: s.parentPhone || "", email: s.email || "", school: s.school || "", grade: s.grade || "", active: s.active ? "Yes" : "No", createdAt: new Date(s.createdAt).toISOString().split("T")[0] }));
    } else if (entity === "enrollments") {
      const enrollments = await Enrollment.find().populate("studentId", "fullName phone").populate("teacherId", "fullName").populate("courseId", "name").populate("subjectId", "name").lean();
      rows = enrollments.map((e) => ({ student: (e.studentId as any)?.fullName || "", teacher: (e.teacherId as any)?.fullName || "", course: (e.courseId as any)?.name || "", subject: (e.subjectId as any)?.name || "", sessions: e.sessionsCount, finalPrice: e.finalPrice, teacherCost: e.teacherCost, paymentPlan: e.paymentPlan, status: e.status, startDate: e.startDate ? new Date(e.startDate).toISOString().split("T")[0] : "", createdAt: new Date(e.createdAt).toISOString().split("T")[0] }));
    } else if (entity === "payments") {
      const payments = await Payment.find().populate("studentId", "fullName phone").lean();
      rows = payments.map((p) => ({ student: (p.studentId as any)?.fullName || "", studentPhone: (p.studentId as any)?.phone || "", amount: p.amount, paymentMethod: p.paymentMethod, paymentDate: new Date(p.paymentDate).toISOString().split("T")[0], notes: p.notes || "" }));
    } else if (entity === "expenses") {
      const expenses = await Expense.find().lean();
      rows = expenses.map((e) => ({ category: e.category, amount: e.amount, expenseDate: new Date(e.expenseDate).toISOString().split("T")[0], payee: e.payee || "", description: e.description || "" }));
    } else {
      return NextResponse.json({ error: `Export not supported for: ${entity}` }, { status: 400 });
    }

    return NextResponse.json({ rows, total: rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}
