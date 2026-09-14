import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { enrollmentStatuses, paymentStatuses, scheduleFormats, teacherPayBases } from "@/models/Enrollment";
import { Payment, paymentMethods } from "@/models/Financial";
import { getNextSequence } from "@/models/Counter";
import { serializeEnrollment, serializeEnrollmentForTrainer } from "@/lib/serializers";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { planStudentInvoice, planCustomerReceipt, postForNewDocument } from "@/lib/accounting/postings";
import { parseAmount } from "@/lib/money";
import { apiError } from "@/lib/api-error";

const allowedPaymentMethods = new Set<string>(paymentMethods);

function derivePaymentType(paymentStatus: string, isFirstPayment: boolean): string {
  if (paymentStatus === "Instalment 1 Paid" || paymentStatus === "Instalment 2 Pending") {
    return "Instalment 1 of 2";
  }
  if (paymentStatus === "Paid Full" && !isFirstPayment) {
    return "Instalment 2 of 2";
  }
  return "Full Payment";
}

const allowedStatuses = new Set<string>(enrollmentStatuses);
const allowedPaymentStatuses = new Set<string>(paymentStatuses);
const allowedFormats = new Set<string>(scheduleFormats);
const allowedPayBases = new Set<string>(teacherPayBases);

function clean(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}


export async function GET(request: NextRequest) {
  // Sales is deliberately NOT here: no sales screen reads this list, and it
  // returned every student's Emirates ID, fees and balance to any sales login.
  const authed = await requireAuth(["admin", "manager", "finance", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const payStatus = searchParams.get("paymentStatus")?.trim();
    const course = searchParams.get("course")?.trim();
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};
    if (status && allowedStatuses.has(status)) query.status = status;
    if (payStatus && allowedPaymentStatuses.has(payStatus)) query.paymentStatus = payStatus;
    if (course) query.course = course;
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); dateQ.$lt = t; }
      query.registrationDate = dateQ;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ fullName: regex }, { phone: regex }, { enrollmentId: regex }];
    }

    // Trainers only ever see registrations assigned to them — never the
    // whole student body (enforced here, not just in the UI).
    if (authed.role === "trainer") {
      const { getTeacherForUser, applyTaughtBy } = await import("@/lib/teacher");
      const teacher = await getTeacherForUser(authed);
      if (!teacher) return NextResponse.json({ enrollments: [] });
      // Co-teaching counts: match the primary trainer or the full list.
      applyTaughtBy(query, teacher._id);
    }

    const enrollments = await Enrollment.find(query).sort({ createdAt: -1 }).lean();
    const serialize = authed.role === "trainer" ? serializeEnrollmentForTrainer : serializeEnrollment;
    return NextResponse.json({ enrollments: enrollments.map(serialize) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load enrollments.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  try {
    await connectDB();
    const body = await request.json();

    const fullName = clean(body.fullName);
    const phone = clean(body.phone);
    const course = clean(body.course);

    if (!fullName) throw new Error("Full name is required.");
    if (!phone) throw new Error("Phone is required.");
    if (!course) throw new Error("Course is required.");

    const status = clean(body.status) || "Active";
    const paymentStatus = clean(body.paymentStatus) || "Instalment 1 Paid";
    const format = clean(body.format) || "In-Person";

    if (!allowedStatuses.has(status)) throw new Error("Invalid status.");
    if (!allowedPaymentStatuses.has(paymentStatus)) throw new Error("Invalid payment status.");
    if (!allowedFormats.has(format)) throw new Error("Invalid format.");

    const totalFee = parseAmount(body.totalFee, { field: "Total fee", allowZero: true });
    const amountPaid = parseAmount(body.amountPaid, { field: "Amount paid", allowZero: true });

    const seq = await getNextSequence("enrollment");
    const enrollmentId = `E-${String(seq).padStart(3, "0")}`;

    const enrollment = await Enrollment.create({
      enrollmentId,
      fullName, phone, course,
      email: clean(body.email) || undefined,
      emiratesId: clean(body.emiratesId) || undefined,
      nationality: clean(body.nationality) || undefined,
      batchName: clean(body.batchName) || undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      schedule: clean(body.schedule) || undefined,
      format, status, paymentStatus,
      totalFee,
      amountPaid,
      notes: clean(body.notes) || undefined,
      leadId: body.leadId || undefined,
      // Teacher assignment & hour tracking. teacherIds is the source of
      // truth; teacherId mirrors the first so existing queries keep working.
      // A lone teacherId is still accepted for older clients.
      ...(() => {
        const raw: string[] = Array.isArray(body.teacherIds)
          ? body.teacherIds.map(String)
          : body.teacherId
            ? [String(body.teacherId)]
            : [];
        const ids = [...new Set(raw.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
        return { teacherId: ids[0], teacherIds: ids };
      })(),
      // Trainer pay for this registration (blank = use the trainer's default)
      teacherPayRate:
        body.teacherPayRate === "" || body.teacherPayRate == null
          ? undefined
          : parseAmount(body.teacherPayRate, { field: "Trainer pay rate", allowZero: true }),
      teacherPayBasis: allowedPayBases.has(clean(body.teacherPayBasis))
        ? clean(body.teacherPayBasis)
        : undefined,
      totalRegisteredHours: body.totalRegisteredHours ? Math.max(0, Number(body.totalRegisteredHours) || 0) : undefined,
      expectedCompletionDate: body.expectedCompletionDate ? new Date(body.expectedCompletionDate) : undefined,
    });

    // Denormalize trainer names + notify every assigned trainer
    if (enrollment.teacherIds?.length) {
      const { default: Teacher } = await import("@/models/Teacher");
      const teachers = await Teacher.find({ _id: { $in: enrollment.teacherIds } })
        .select("fullName email")
        .lean();
      const byId = new Map(teachers.map((t) => [t._id.toString(), t]));
      // Keep names index-aligned with teacherIds
      enrollment.teacherNames = enrollment.teacherIds.map(
        (id) => byId.get(id.toString())?.fullName ?? ""
      );
      enrollment.teacherName = enrollment.teacherNames[0] || undefined;
      await enrollment.save();

      const { notify } = await import("@/lib/notify");
      for (const t of teachers) {
        if (!t.email) continue;
        notify({
          userEmail: t.email,
          title: `New student assigned: ${enrollment.fullName}`,
          body: `${enrollment.course} — new registration assigned to you.`,
          link: "/my-students",
        });
      }
    }

    // Accounting: invoice entry — Dr A/R, Cr Course Revenue (+ Cr Output VAT).
    // A posting failure is recorded on the registration and reported, instead
    // of being swallowed as it used to be.
    const warnings: string[] = [];
    if (totalFee > 0) {
      const { postingError } = await postForNewDocument(await planStudentInvoice({
        sourceId: enrollment._id.toString(),
        sourceNumber: enrollmentId,
        date: enrollment.registrationDate ?? new Date(),
        studentName: fullName,
        course,
        totalFee,
        createdBy: authed.name,
      }));
      if (postingError) {
        enrollment.postingError = postingError;
        await enrollment.save();
        warnings.push(`the invoice entry failed: ${postingError}`);
      }
    }

    let paymentRef = "";
    if (amountPaid > 0) {
      const paymentType = derivePaymentType(paymentStatus, true);
      const rawMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
      const paymentMethod = allowedPaymentMethods.has(rawMethod) ? rawMethod : "Cash";
      const seq = await getNextSequence("payment");
      const paymentId = `P-${String(seq).padStart(3, "0")}`;
      paymentRef = paymentId;
      const payment = await Payment.create({
        paymentId,
        enrollmentId: enrollment._id,
        studentName: fullName,
        studentPhone: clean(body.phone) || undefined,
        course: course || undefined,
        amount: amountPaid,
        paymentType,
        paymentMethod,
        status: "Received",
        datePaid: new Date(),
        recordedBy: authed.name,
        notes: `Auto-recorded from enrollment ${enrollment.enrollmentId}`,
      });
      // Accounting: receipt entry — Dr Cash/Bank, Cr A/R
      const { entry, postingError } = await postForNewDocument(await planCustomerReceipt({
        sourceId: payment._id.toString(),
        sourceNumber: paymentId,
        date: payment.datePaid!,
        studentName: fullName,
        course,
        amount: amountPaid,
        paymentMethod,
        createdBy: authed.name,
        enrollmentId: enrollment._id.toString(),
      }));
      if (entry || postingError) {
        if (entry) payment.journalEntryId = entry._id as never;
        if (postingError) {
          payment.postingError = postingError;
          warnings.push(`the receipt entry failed: ${postingError}`);
        }
        await payment.save();
      }
    }

    await logAudit({
      userName: authed.name, userRole: authed.role, action: "created", entity: "Enrollment",
      entityId: enrollment._id.toString(), entityLabel: enrollment.fullName,
      detail: `${enrollment.course} · ${enrollment.enrollmentId} · fee AED ${totalFee}` +
        `${amountPaid > 0 ? ` · paid AED ${amountPaid} (${paymentRef})` : ""}` +
        `${warnings.length ? ` · LEDGER POSTING FAILED: ${warnings.join("; ")}` : ""}`,
    });
    return NextResponse.json(
      {
        enrollment: serializeEnrollment(enrollment),
        ...(warnings.length ? { warning: `Saved, but ${warnings.join("; ")}` } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, "Failed to create enrollment.", "enrollments");
  }
}
