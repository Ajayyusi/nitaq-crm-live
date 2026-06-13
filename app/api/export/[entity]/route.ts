import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { IMPORT_EXPORT_PERMISSIONS, hasRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import FollowUp from "@/models/FollowUp";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import { Payment, Expense } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";

type RouteContext = { params: Promise<{ entity: string }> };

function toDate(d: unknown): string {
  if (!d) return "";
  try { return new Date(d as string).toISOString().slice(0, 10); } catch { return ""; }
}

export async function GET(_req: Request, context: RouteContext) {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  const { entity } = await context.params;

  const entityPerms = IMPORT_EXPORT_PERMISSIONS[entity];
  if (!entityPerms || !hasRole(authed.role as AppRole, entityPerms.export)) {
    return NextResponse.json({ error: "You do not have permission to export this data." }, { status: 403 });
  }

  await connectDB();

  try {
    let rows: Record<string, unknown>[] = [];

    if (entity === "leads") {
      const docs = await Lead.find({}).sort({ createdAt: -1 }).lean();
      rows = docs.map((d) => ({
        leadId: d.leadId ?? "",
        fullName: d.fullName,
        phone: d.phone,
        email: d.email ?? "",
        course: d.course,
        source: d.source,
        stage: d.stage,
        nextFollowUpDate: toDate(d.nextFollowUpDate),
        assignedTo: d.assignedTo ?? "",
        notes: d.notes ?? "",
      }));
    } else if (entity === "followups") {
      const docs = await FollowUp.find({}).sort({ followUpDate: -1 }).lean();
      rows = docs.map((d) => ({
        contactName: d.contactName,
        phone: d.phone,
        course: d.course ?? "",
        followUpDate: toDate(d.followUpDate),
        type: d.type,
        notes: d.notes ?? "",
        status: d.status,
        assignedTo: d.assignedTo ?? "",
      }));
    } else if (entity === "students" || entity === "enrollments") {
      const docs = await Enrollment.find({}).sort({ createdAt: -1 }).lean();
      rows = docs.map((d) => ({
        enrollmentId: d.enrollmentId ?? "",
        fullName: d.fullName,
        phone: d.phone,
        email: d.email ?? "",
        emiratesId: d.emiratesId ?? "",
        nationality: d.nationality ?? "",
        course: d.course,
        batchName: d.batchName ?? "",
        startDate: toDate(d.startDate),
        endDate: toDate(d.endDate),
        schedule: d.schedule ?? "",
        format: d.format,
        status: d.status,
        paymentStatus: d.paymentStatus,
        totalFee: d.totalFee,
        amountPaid: d.amountPaid,
        notes: d.notes ?? "",
      }));
    } else if (entity === "courses") {
      const docs = await Course.find({}).sort({ createdAt: -1 }).lean();
      rows = docs.map((d) => ({
        courseCode: d.courseCode,
        courseName: d.courseName,
        category: d.category,
        description: d.description ?? "",
        durationWeeks: d.durationWeeks ?? "",
        totalSessions: d.totalSessions ?? "",
        sessionsPerWeek: d.sessionsPerWeek ?? "",
        hoursPerSession: d.hoursPerSession ?? "",
        priceExVat: d.priceExVat,
        vatRate: d.vatRate,
        maxStudentsPerBatch: d.maxStudentsPerBatch ?? "",
        status: d.status,
      }));
    } else if (entity === "teachers") {
      const docs = await Teacher.find({}).sort({ createdAt: -1 }).lean();
      rows = docs.map((d) => ({
        fullName: d.fullName,
        phone: d.phone,
        email: d.email ?? "",
        emiratesId: d.emiratesId ?? "",
        nationality: d.nationality ?? "",
        specialisation: d.specialisation ?? "",
        qualifications: d.qualifications ?? "",
        tamamStatus: d.tamamStatus,
        tamamNumber: d.tamamNumber ?? "",
        contractStatus: d.contractStatus,
        contractStartDate: toDate(d.contractStartDate),
        contractEndDate: toDate(d.contractEndDate),
        paymentRate: d.paymentRate ?? "",
        paymentType: d.paymentType,
        status: d.status,
        notes: d.notes ?? "",
      }));
    } else if (entity === "payments") {
      const docs = await Payment.find({}).sort({ createdAt: -1 }).lean();
      rows = docs.map((d) => ({
        paymentId: d.paymentId ?? "",
        studentName: d.studentName,
        studentPhone: d.studentPhone ?? "",
        course: d.course ?? "",
        amount: d.amount,
        paymentType: d.paymentType,
        paymentMethod: d.paymentMethod,
        status: d.status,
        datePaid: toDate(d.datePaid),
        dueDate: toDate(d.dueDate),
        receiptRef: d.receiptRef ?? "",
        notes: d.notes ?? "",
      }));
    } else if (entity === "expenses") {
      const docs = await Expense.find({}).sort({ expenseDate: -1 }).lean();
      rows = docs.map((d) => ({
        expenseId: d.expenseId ?? "",
        category: d.category,
        amount: d.amount,
        expenseDate: toDate(d.expenseDate),
        payee: d.payee ?? "",
        description: d.description ?? "",
        notes: d.notes ?? "",
      }));
    } else if (entity === "classes") {
      const docs = await AttendanceSession.find({}).sort({ sessionDate: -1 }).lean();
      rows = docs.map((d) => ({
        course: d.course,
        batchName: d.batchName ?? "",
        sessionDate: toDate(d.sessionDate),
        sessionNumber: d.sessionNumber ?? "",
        topic: d.topic ?? "",
        trainerName: d.trainerName ?? "",
        studentsPresent: d.records.filter((r: { status: string }) => r.status === "Present").length,
        totalStudents: d.records.length,
      }));
    } else {
      return NextResponse.json({ message: `Unknown entity: ${entity}` }, { status: 400 });
    }

    return NextResponse.json({ rows });
  } catch (err) {
    console.error(`Export error [${entity}]:`, err);
    return NextResponse.json({ message: "Export failed. Please try again." }, { status: 500 });
  }
}
