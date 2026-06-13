import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { IMPORT_EXPORT_PERMISSIONS, hasRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import connectDB from "@/lib/db";
import Lead from "@/models/Lead";
import FollowUp, { followUpTypes, followUpStatuses } from "@/models/FollowUp";
import Enrollment, { enrollmentStatuses, paymentStatuses, scheduleFormats } from "@/models/Enrollment";
import Course, { courseCategories, courseStatuses } from "@/models/Course";
import Teacher, {
  tamamStatuses,
  contractStatuses,
  paymentTypes as trainerPaymentTypes,
  trainerStatuses,
} from "@/models/Teacher";
import { Payment, Expense, paymentMethods, paymentTypes, txStatuses, expenseCategories } from "@/models/Financial";
import AttendanceSession from "@/models/Attendance";
import { getNextSequence } from "@/models/Counter";
import { leadSources, leadStages, courseList } from "@/constants/leads";

type RouteContext = { params: Promise<{ entity: string }> };
type RowError = { row: number; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest, context: RouteContext) {
  const authed = await requireAuth();
  if (authed instanceof NextResponse) return authed;

  const { entity } = await context.params;

  const entityPerms = IMPORT_EXPORT_PERMISSIONS[entity];
  if (!entityPerms || !hasRole(authed.role as AppRole, entityPerms.import)) {
    return NextResponse.json({ error: "You do not have permission to import this data." }, { status: 403 });
  }

  const body = await req.json();

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ message: "Request body must include a 'rows' array." }, { status: 400 });
  }

  const rows: Record<string, string>[] = body.rows;
  const MAX_ROWS = 500;

  if (!rows.length) {
    return NextResponse.json({ total: 0, success: 0, failed: 0, errors: [] });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { message: `Too many rows. Maximum allowed per import is ${MAX_ROWS}. Split your file and import in batches.` },
      { status: 400 }
    );
  }

  await connectDB();

  const errors: RowError[] = [];
  let success = 0;

  if (entity === "leads") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.fullName)) { errors.push({ row: rowNum, error: "fullName is required" }); continue; }
      if (!str(r.phone)) { errors.push({ row: rowNum, error: "phone is required" }); continue; }
      const phone = str(r.phone);
      const duplicate = await Lead.findOne({ phone });
      if (duplicate) { errors.push({ row: rowNum, error: `Duplicate: a lead with phone ${phone} already exists` }); continue; }
      const source = (leadSources as readonly string[]).includes(r.source) ? r.source : "Other";
      const stage = (leadStages as readonly string[]).includes(r.stage) ? r.stage : "Lead";
      const course = (courseList as readonly string[]).includes(r.course) ? r.course : "Other";
      try {
        const seq = await getNextSequence("lead");
        await Lead.create({
          leadId: `L-${String(seq).padStart(3, "0")}`,
          fullName: str(r.fullName),
          phone,
          email: str(r.email) || undefined,
          course,
          source,
          stage,
          notes: str(r.notes) || undefined,
          nextFollowUpDate: r.nextFollowUpDate ? new Date(r.nextFollowUpDate) : undefined,
          assignedTo: str(r.assignedTo) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "followups") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.contactName)) { errors.push({ row: rowNum, error: "contactName is required" }); continue; }
      if (!str(r.phone)) { errors.push({ row: rowNum, error: "phone is required" }); continue; }
      if (!r.followUpDate) { errors.push({ row: rowNum, error: "followUpDate is required" }); continue; }
      const type = (followUpTypes as readonly string[]).includes(r.type) ? r.type : "WhatsApp Message";
      const status = (followUpStatuses as readonly string[]).includes(r.status) ? r.status : "Pending";
      try {
        await FollowUp.create({
          contactName: str(r.contactName),
          phone: str(r.phone),
          course: str(r.course) || undefined,
          followUpDate: new Date(r.followUpDate),
          type,
          notes: str(r.notes) || undefined,
          status,
          assignedTo: str(r.assignedTo) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "students" || entity === "enrollments") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.fullName)) { errors.push({ row: rowNum, error: "fullName is required" }); continue; }
      if (!str(r.phone)) { errors.push({ row: rowNum, error: "phone is required" }); continue; }
      if (!str(r.course)) { errors.push({ row: rowNum, error: "course is required" }); continue; }
      const phone = str(r.phone);
      const course = str(r.course);
      const duplicate = await Enrollment.findOne({ phone, course });
      if (duplicate) { errors.push({ row: rowNum, error: `Duplicate: an enrollment for phone ${phone} in "${course}" already exists` }); continue; }
      const status = (enrollmentStatuses as readonly string[]).includes(r.status) ? r.status : "Active";
      const paymentStatus = (paymentStatuses as readonly string[]).includes(r.paymentStatus) ? r.paymentStatus : "Instalment 1 Paid";
      const format = (scheduleFormats as readonly string[]).includes(r.format) ? r.format : "In-Person";
      try {
        const seq = await getNextSequence("enrollment");
        await Enrollment.create({
          enrollmentId: `E-${String(seq).padStart(3, "0")}`,
          fullName: str(r.fullName),
          phone,
          email: str(r.email) || undefined,
          emiratesId: str(r.emiratesId) || undefined,
          nationality: str(r.nationality) || undefined,
          course,
          batchName: str(r.batchName) || undefined,
          startDate: r.startDate ? new Date(r.startDate) : undefined,
          endDate: r.endDate ? new Date(r.endDate) : undefined,
          schedule: str(r.schedule) || undefined,
          format,
          status,
          paymentStatus,
          totalFee: Number(r.totalFee) || 0,
          amountPaid: Number(r.amountPaid) || 0,
          notes: str(r.notes) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "courses") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.courseCode)) { errors.push({ row: rowNum, error: "courseCode is required" }); continue; }
      if (!str(r.courseName)) { errors.push({ row: rowNum, error: "courseName is required" }); continue; }
      if (!(courseCategories as readonly string[]).includes(r.category)) {
        errors.push({ row: rowNum, error: `category must be one of: ${courseCategories.join(", ")}` });
        continue;
      }
      const status = (courseStatuses as readonly string[]).includes(r.status) ? r.status : "Active";
      try {
        await Course.create({
          courseCode: str(r.courseCode).toUpperCase(),
          courseName: str(r.courseName),
          category: r.category,
          description: str(r.description) || undefined,
          durationWeeks: r.durationWeeks ? Number(r.durationWeeks) : undefined,
          totalSessions: r.totalSessions ? Number(r.totalSessions) : undefined,
          sessionsPerWeek: r.sessionsPerWeek ? Number(r.sessionsPerWeek) : undefined,
          hoursPerSession: r.hoursPerSession ? Number(r.hoursPerSession) : undefined,
          priceExVat: Number(r.priceExVat) || 0,
          vatRate: r.vatRate !== undefined && r.vatRate !== "" ? Number(r.vatRate) : 5,
          maxStudentsPerBatch: r.maxStudentsPerBatch ? Number(r.maxStudentsPerBatch) : undefined,
          status,
        });
        success++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to save";
        const clean = msg.includes("duplicate key") ? `courseCode "${str(r.courseCode).toUpperCase()}" already exists` : msg;
        errors.push({ row: rowNum, error: clean });
      }
    }
  } else if (entity === "teachers") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.fullName)) { errors.push({ row: rowNum, error: "fullName is required" }); continue; }
      if (!str(r.phone)) { errors.push({ row: rowNum, error: "phone is required" }); continue; }
      const phone = str(r.phone);
      const duplicate = await Teacher.findOne({ phone });
      if (duplicate) { errors.push({ row: rowNum, error: `Duplicate: a teacher with phone ${phone} already exists` }); continue; }
      const tamamStatus = (tamamStatuses as readonly string[]).includes(r.tamamStatus) ? r.tamamStatus : "Not Registered";
      const contractStatus = (contractStatuses as readonly string[]).includes(r.contractStatus) ? r.contractStatus : "No Contract";
      const paymentType = (trainerPaymentTypes as readonly string[]).includes(r.paymentType) ? r.paymentType : "Per Session";
      const status = (trainerStatuses as readonly string[]).includes(r.status) ? r.status : "Active";
      try {
        await Teacher.create({
          fullName: str(r.fullName),
          phone,
          email: str(r.email) || undefined,
          emiratesId: str(r.emiratesId) || undefined,
          nationality: str(r.nationality) || undefined,
          specialisation: str(r.specialisation) || undefined,
          qualifications: str(r.qualifications) || undefined,
          tamamStatus,
          tamamNumber: str(r.tamamNumber) || undefined,
          contractStatus,
          contractStartDate: r.contractStartDate ? new Date(r.contractStartDate) : undefined,
          contractEndDate: r.contractEndDate ? new Date(r.contractEndDate) : undefined,
          paymentRate: r.paymentRate ? Number(r.paymentRate) : undefined,
          paymentType,
          status,
          notes: str(r.notes) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "payments") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.studentName)) { errors.push({ row: rowNum, error: "studentName is required" }); continue; }
      if (!r.amount || Number(r.amount) <= 0) { errors.push({ row: rowNum, error: "amount must be > 0" }); continue; }
      const paymentMethod = (paymentMethods as readonly string[]).includes(r.paymentMethod) ? r.paymentMethod : "Cash";
      const paymentType = (paymentTypes as readonly string[]).includes(r.paymentType) ? r.paymentType : "Full Payment";
      const status = (txStatuses as readonly string[]).includes(r.status) ? r.status : "Received";
      try {
        const seq = await getNextSequence("payment");
        await Payment.create({
          paymentId: `P-${String(seq).padStart(3, "0")}`,
          studentName: str(r.studentName),
          studentPhone: str(r.studentPhone) || undefined,
          course: str(r.course) || undefined,
          amount: Number(r.amount),
          paymentType,
          paymentMethod,
          status,
          datePaid: r.datePaid ? new Date(r.datePaid) : undefined,
          dueDate: r.dueDate ? new Date(r.dueDate) : undefined,
          receiptRef: str(r.receiptRef) || undefined,
          notes: str(r.notes) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "expenses") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!(expenseCategories as readonly string[]).includes(r.category)) {
        errors.push({ row: rowNum, error: `category must be one of: ${expenseCategories.join(", ")}` });
        continue;
      }
      if (!r.amount || Number(r.amount) <= 0) { errors.push({ row: rowNum, error: "amount must be > 0" }); continue; }
      try {
        const seq = await getNextSequence("expense");
        await Expense.create({
          expenseId: `EXP-${String(seq).padStart(3, "0")}`,
          category: r.category,
          amount: Number(r.amount),
          expenseDate: r.expenseDate ? new Date(r.expenseDate) : new Date(),
          payee: str(r.payee) || undefined,
          description: str(r.description) || undefined,
          notes: str(r.notes) || undefined,
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else if (entity === "classes") {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      if (!str(r.course)) { errors.push({ row: rowNum, error: "course is required" }); continue; }
      if (!r.sessionDate) { errors.push({ row: rowNum, error: "sessionDate is required" }); continue; }
      try {
        await AttendanceSession.create({
          course: str(r.course),
          batchName: str(r.batchName) || undefined,
          sessionDate: new Date(r.sessionDate),
          sessionNumber: r.sessionNumber ? Number(r.sessionNumber) : undefined,
          topic: str(r.topic) || undefined,
          trainerName: str(r.trainerName) || undefined,
          records: [],
        });
        success++;
      } catch (e: unknown) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : "Failed to save" });
      }
    }
  } else {
    return NextResponse.json({ message: `Unknown entity: ${entity}` }, { status: 400 });
  }

  return NextResponse.json({
    total: rows.length,
    success,
    failed: errors.length,
    errors,
  });
}
