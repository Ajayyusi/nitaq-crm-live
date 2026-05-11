import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { auth } from "@/lib/auth";
import Lead from "@/models/Lead";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import { Payment, Expense } from "@/models/Financial";

type Ctx = { params: Promise<{ entity: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { entity } = await ctx.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userRole = (session.user as any).role;
    if (!["super_admin", "admin"].includes(userRole))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await connectDB();
    const { rows } = await req.json();
    const userId = (session.user as any).id;
    let success = 0, failed = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (entity === "leads") {
          if (!row.studentName || !row.studentPhone) throw new Error("Missing studentName or studentPhone");
          await Lead.create({ studentName: row.studentName, studentPhone: row.studentPhone, parentPhone: row.parentPhone, email: row.email, mode: row.mode || "offline", leadSource: row.leadSource || "other", preferredTime: row.preferredTime, notes: row.notes, status: "new", assignedSalesUser: userId });
        } else if (entity === "teachers") {
          if (!row.fullName || !row.phone) throw new Error("Missing fullName or phone");
          const existing = await Teacher.findOne({ phone: row.phone });
          if (existing) throw new Error(`Teacher with phone ${row.phone} already exists`);
          await Teacher.create({ fullName: row.fullName, phone: row.phone, whatsapp: row.whatsapp, email: row.email, jobTitle: row.jobTitle, employmentType: row.employmentType || "part_time", status: row.status || "active", branchPreference: row.branchPreference, notes: row.notes });
        } else if (entity === "students") {
          if (!row.fullName || !row.phone) throw new Error("Missing fullName or phone");
          await Student.create({ fullName: row.fullName, phone: row.phone, parentPhone: row.parentPhone, email: row.email, school: row.school, grade: row.grade, notes: row.notes });
        } else if (entity === "expenses") {
          if (!row.amount || !row.category) throw new Error("Missing amount or category");
          await Expense.create({ category: row.category, amount: parseFloat(row.amount), expenseDate: row.expenseDate ? new Date(row.expenseDate) : new Date(), payee: row.payee, description: row.description, createdBy: userId });
        } else {
          throw new Error(`Import not supported for: ${entity}`);
        }
        success++;
      } catch (e: any) {
        errors.push({ row: i + 2, error: e.message });
        failed++;
      }
    }

    return NextResponse.json({ total: rows.length, success, failed, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
  }
}
